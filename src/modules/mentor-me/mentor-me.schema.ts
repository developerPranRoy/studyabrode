import { z } from 'zod';
import { idParam, idSchema, timezoneSchema } from '../../utils/commonSchemas.js';

const DAY_MS = 86_400_000;
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform((value) => value || undefined);
const uniqueIds = (min: number, max: number) =>
  z.array(idSchema).min(min).max(max).refine((ids) => new Set(ids).size === ids.length, 'Duplicate ids');

const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24 hour)');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date');
const thisYear = new Date().getFullYear();
const year = z.number().int().min(1950).max(thisYear + 10);

/** "09:00" -> 540 (minutes after midnight, how availability is stored). */
export const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

// ----------------------------------------------------------- wizard steps ----
export const sourceSchema = { body: z.object({ sourceId: idSchema }) }; // step 1

export const profileSchema = {
  body: z.object({
    firstName: text(1, 40),
    middleName: optionalText(40),
    lastName: text(1, 40),
    nationalityId: idSchema,
    phone: z.string().trim().regex(/^\+?[0-9 ]{6,20}$/, 'Invalid phone number').optional(),
    sellingPoint: text(10, 500), // "Your unique selling point for guiding students"
    photoCrop: z.object({ zoom: z.number().min(0.1).max(10), x: z.number().min(-5000).max(5000), y: z.number().min(-5000).max(5000) }).optional(),
  }),
}; // step 2

const address = z.object({ street: optionalText(200), city: text(1, 80), countryId: idSchema });

export const locationSchema = {
  body: z.object({
    current: address,
    permanent: z.discriminatedUnion('sameAsCurrent', [
      z.object({ sameAsCurrent: z.literal(true) }),
      z.object({ sameAsCurrent: z.literal(false), address }),
    ]),
  }),
}; // step 3

const education = z
  .object({
    universityName: text(2, 200), // picked from GET /lookups/universities (or typed)
    countryId: idSchema, // the university's country
    statusId: idSchema, // GET /lookups/mentor-onboarding-options -> educationStatuses
    programId: idSchema, // the degree
    fieldOfStudy: text(2, 120),
    admissionYear: year,
    graduationYear: year.optional(),
    city: optionalText(80),
    scholarshipNote: optionalText(300), // university-specific scholarship (not a named program)
  })
  .refine((e) => !e.graduationYear || e.graduationYear >= e.admissionYear, {
    message: 'graduationYear cannot be before admissionYear',
    path: ['graduationYear'],
  });

export const abroadEducationSchema = { body: z.object({ educations: z.array(education).min(1).max(10) }) }; // step 4
export const backgroundEducationSchema = { body: z.object({ educations: z.array(education).max(10) }) };

export const scholarshipsSchema = {
  body: z
    .object({
      noScholarshipProgram: z.boolean(),
      programs: z.array(z.object({ scholarshipId: idSchema, outcome: z.enum(['APPLIED', 'RECEIVED']) })).max(20),
    })
    .refine((b) => b.noScholarshipProgram !== b.programs.length > 0, 'Add a scholarship program or choose "I did not apply"')
    .refine((b) => new Set(b.programs.map((p) => p.scholarshipId)).size === b.programs.length, 'Duplicate scholarship'),
}; // step 5

export const expertiseSchema = { body: z.object({ helpTopicIds: uniqueIds(1, 20) }) }; // step 6

const range = z.object({ start: clock, end: clock }).refine((r) => toMinutes(r.start) < toMinutes(r.end), 'end must be after start');

export const weeklyAvailabilitySchema = {
  body: z.object({
    timezone: timezoneSchema,
    // weekday 0 = Sunday ... 6 = Saturday; days that are not listed are unavailable
    weekly: z
      .array(z.object({ weekday: z.number().int().min(0).max(6), ranges: z.array(range).min(1).max(6) }))
      .min(1, 'Please add at least one time slot for your availability')
      .max(7)
      .refine((days) => new Set(days.map((d) => d.weekday)).size === days.length, 'Each weekday may appear once')
      .refine(
        (days) => days.every(({ ranges }) => {
          const sorted = [...ranges].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
          return sorted.every((r, i) => i === 0 || toMinutes(r.start) >= toMinutes(sorted[i - 1].end));
        }),
        'Time ranges of a day must not overlap',
      ),
    availableUntil: isoDate.nullable(), // null = no end date (ongoing); 1 / 3 / 6 months or a date otherwise
  }),
}; // step 7

export const oneOffSlotSchema = {
  body: z.object({ date: isoDate, start: clock, end: clock }).refine((s) => toMinutes(s.start) < toMinutes(s.end), 'end must be after start'),
};
export const slotIdParams = { params: z.object({ slotId: idParam }) };

export const calendarSchema = {
  query: z
    .object({ from: isoDate, to: isoDate })
    .refine((q) => q.to >= q.from, 'to must not be before from')
    .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / DAY_MS <= 92, 'Range is limited to 92 days'),
};

export const pricingSchema = {
  body: z.object({
    prices: z
      .array(z.object({ marketId: idSchema, serviceId: idSchema, price: z.number().positive().max(1_000_000) }))
      .min(1)
      .max(50)
      .refine((rows) => new Set(rows.map((r) => `${r.marketId}:${r.serviceId}`)).size === rows.length, 'Duplicate price'),
  }),
}; // step 8

export const payoutSchema = {
  body: z.object({
    methodId: idSchema,
    // The fields each method needs come from the database (payout_methods.requiredFields).
    details: z.record(z.string().trim().min(1).max(120)).refine((d) => Object.keys(d).length <= 15, 'Too many fields'),
    confirmed: z.literal(true, { errorMap: () => ({ message: 'Please confirm the payout details are accurate' }) }),
  }),
}; // step 9

export const socialSchema = {
  body: z.object({
    links: z
      .array(z.object({ platformId: idSchema, url: z.string().trim().url().max(300) }))
      .min(1, 'Add at least one social profile')
      .max(10)
      .refine((links) => new Set(links.map((l) => l.platformId)).size === links.length, 'One link per platform'),
  }),
}; // step 10

export const growthSchema = { body: z.object({ sharedOnSocial: z.boolean() }) }; // step 12

export const experiencesSchema = {
  body: z.object({
    experiences: z
      .array(
        z
          .object({
            kind: z.enum(['ACTIVITY', 'WORK']),
            title: text(2, 120),
            organization: text(2, 120),
            startYear: year.optional(),
            endYear: year.optional(),
            description: optionalText(1000),
          })
          .refine((e) => !e.startYear || !e.endYear || e.endYear >= e.startYear, 'endYear cannot be before startYear'),
      )
      .max(30),
  }),
};

export const timezoneSchemaBody = { body: z.object({ timezone: timezoneSchema }) };

export const bookingsRangeSchema = {
  query: z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() }).refine(
    (q) => !q.from || !q.to || q.to > q.from, 'to must be after from',
  ),
};

export type SourceInput = z.infer<typeof sourceSchema.body>;
export type ProfileInput = z.infer<typeof profileSchema.body>;
export type LocationInput = z.infer<typeof locationSchema.body>;
export type EducationInput = z.infer<typeof education>;
export type ScholarshipsInput = z.infer<typeof scholarshipsSchema.body>;
export type WeeklyAvailabilityInput = z.infer<typeof weeklyAvailabilitySchema.body>;
export type OneOffSlotInput = z.infer<typeof oneOffSlotSchema.body>;
export type PricingInput = z.infer<typeof pricingSchema.body>;
export type PayoutInput = z.infer<typeof payoutSchema.body>;
export type SocialInput = z.infer<typeof socialSchema.body>;
export type ExperiencesInput = z.infer<typeof experiencesSchema.body>;
