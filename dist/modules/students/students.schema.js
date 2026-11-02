import { z } from 'zod';
import { idSchema, optional, timezoneSchema } from '../../utils/commonSchemas.js';
const uniqueIds = (min, max) => z.array(idSchema).min(min).max(max).refine((ids) => new Set(ids).size === ids.length, 'Duplicate ids');
const ielts = z.discriminatedUnion('taken', [
    z.object({ taken: z.literal(true), score: z.number().min(0).max(9).multipleOf(0.5) }), // half bands allowed
    z.object({ taken: z.literal(false) }),
]);
/**
 * Answers of the 13-step onboarding questionnaire. Every option is an id from a reference
 * table (see GET /lookups/onboarding-options), so the allowed values live in the database.
 */
export const onboardingSchema = z
    .object({
    programId: idSchema, // step 1
    fieldIds: uniqueIds(1, 20), // step 2
    regionIds: uniqueIds(1, 10), // step 3
    countryIds: uniqueIds(0, 40), // step 4
    countriesOther: z.boolean().default(false),
    budgetRangeId: idSchema, // step 5
    fundingNeedId: idSchema, // step 6
    workWhileStudying: z.boolean(), // step 7
    stayAfterStudy: z.enum(['YES', 'NO', 'NOT_ESSENTIAL']), // step 8
    ielts, // step 9
    applyMode: z.enum(['SELF', 'ASSISTED']), // step 10
    helpTopicIds: uniqueIds(0, 20).default([]), // step 11
    timezone: timezoneSchema, // step 12
    sourceId: idSchema, // step 13
})
    .refine((o) => o.applyMode === 'SELF' || o.helpTopicIds.length > 0, {
    message: 'Choose at least one help topic',
    path: ['helpTopicIds'],
})
    .refine((o) => o.countryIds.length > 0 || o.countriesOther, {
    message: 'Choose at least one country (or Other)',
    path: ['countryIds'],
});
const name = z.string().trim().min(1).max(40);
export const updateProfileSchema = {
    body: z.object({ firstName: name, lastName: name, onboarding: onboardingSchema }),
};
export const timezoneBodySchema = { body: z.object({ timezone: timezoneSchema }) };
export const scheduleSchema = {
    query: z
        .object({
        from: optional(z.coerce.date()),
        to: optional(z.coerce.date()),
        type: optional(z.enum(['ONE_ON_ONE', 'GROUP'])),
    })
        .refine((q) => !q.from || !q.to || q.to > q.from, 'to must be after from')
        .refine((q) => !q.from || !q.to || q.to.getTime() - q.from.getTime() <= 366 * 86_400_000, 'Range is limited to 366 days'),
};
export const savedMentorParams = { params: z.object({ mentorId: z.coerce.number().pipe(idSchema) }) };
//# sourceMappingURL=students.schema.js.map