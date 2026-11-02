import { prisma } from '../../config/prisma.js';
import { fileUrl, removeUpload } from '../../middlewares/upload.js';
import { AppError } from '../../utils/AppError.js';
import { assertOwner } from '../../utils/ownership.js';
import type { ListQuery, MentorFilters, MentorInput } from './mentors.schema.js';

const EXPORT_LIMIT = 1000;

// LIKE wildcards in user input must be literal characters.
const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

// ---------------------------------------------------------------- reads ----
interface Ref {
  id: number;
  name: string;
  slug?: string;
}

interface MentorRow {
  id: number;
  fullName: string;
  headline: string;
  bio: string;
  photoPath: string | null;
  hasCv: boolean;
  rating: number;
  sessionsCount: number;
  startingPrice: number | null;
  isSaved: boolean;
  country: Ref;
  university: Ref;
  program: Ref;
  scholarship: Ref | null;
  plans: { id: number; serviceId: number; service: string; durationMin: number; price: number }[];
  totalCount: number;
}

export type Mentor = Omit<MentorRow, 'totalCount' | 'photoPath'> & { photoUrl: string | null };

interface Query extends MentorFilters {
  limit?: number;
  offset?: number;
  id?: number;
  userId?: number;
  viewerId?: number;
  savedOnly?: boolean;
}

// Every read goes through fn_get_mentors. All values are bound parameters.
const queryMentors = async ({
  country, program, scholarship, service, search, sort = 'top_rated',
  limit = 1, offset = 0, id, userId, viewerId, savedOnly = false,
}: Query): Promise<{ items: Mentor[]; total: number }> => {
  const rows = await prisma.$queryRaw<MentorRow[]>`
    SELECT * FROM fn_get_mentors(
      ${country ?? null}::text, ${program ?? null}::text, ${scholarship ?? null}::text,
      ${service ?? null}::text, ${search ? escapeLike(search) : null}::text, ${sort}::text,
      ${limit}::int, ${offset}::int, ${id ?? null}::int, ${userId ?? null}::int,
      ${viewerId ?? null}::int, ${savedOnly}::boolean
    )`;
  return {
    total: rows[0]?.totalCount ?? 0,
    items: rows.map(({ totalCount, photoPath, ...mentor }) => ({ ...mentor, photoUrl: fileUrl(photoPath) })),
  };
};

/** `viewer` (a logged-in student) fills `isSaved`; `savedOnly` returns just their saved mentors. */
export const list = async (
  { page, limit, ...filters }: ListQuery,
  viewer?: { id: number; savedOnly?: boolean },
) => {
  const { items, total } = await queryMentors({
    ...filters, limit, offset: (page - 1) * limit, viewerId: viewer?.id, savedOnly: viewer?.savedOnly,
  });
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const listForExport = async (filters: MentorFilters) =>
  (await queryMentors({ ...filters, limit: EXPORT_LIMIT })).items;

const firstOrNotFound = async (query: Query, message: string) => {
  const {
    items: [mentor],
  } = await queryMentors(query);
  if (!mentor) throw AppError.notFound(message);
  return mentor;
};

export const getById = (id: number, viewerId?: number) => firstOrNotFound({ id, viewerId }, 'Mentor not found');
export const getMine = (userId: number) => firstOrNotFound({ userId }, 'You have not created a mentor profile yet');

// -------------------------------------------------------------- writes ----
const findOwned = async (id: number, userId: number) =>
  assertOwner(
    await prisma.mentorProfile.findUnique({ where: { id }, select: { userId: true, photoPath: true, cvPath: true } }),
    'userId', userId, 'Mentor',
  );

// University rows are created lazily from the name the mentor picked in the external list.
const relations = ({ countryId, universityName, programId }: MentorInput) => ({
  country: { connect: { id: countryId } },
  university: {
    connectOrCreate: {
      where: { name_countryId: { name: universityName, countryId } },
      create: { name: universityName, countryId },
    },
  },
  program: { connect: { id: programId } },
});

export const create = async (userId: number, body: MentorInput) => {
  const { id } = await prisma.mentorProfile.create({
    data: {
      headline: body.headline,
      bio: body.bio,
      user: { connect: { id: userId } }, // userId is unique -> a second profile gives 409
      ...relations(body),
      scholarship: body.scholarshipId ? { connect: { id: body.scholarshipId } } : undefined,
      plans: { create: body.plans },
    },
    select: { id: true },
  });
  return getById(id);
};

// Master + detail are saved atomically (Prisma wraps nested writes in one transaction).
export const update = async (id: number, userId: number, body: MentorInput) => {
  await findOwned(id, userId);
  await prisma.mentorProfile.update({
    where: { id },
    data: {
      headline: body.headline,
      bio: body.bio,
      ...relations(body),
      scholarship: body.scholarshipId ? { connect: { id: body.scholarshipId } } : { disconnect: true },
      plans: {
        deleteMany: { serviceId: { notIn: body.plans.map((plan) => plan.serviceId) } },
        upsert: body.plans.map(({ serviceId, price }) => ({
          where: { mentorId_serviceId: { mentorId: id, serviceId } },
          update: { price },
          create: { serviceId, price },
        })),
      },
    },
  });
  return getById(id);
};

export const remove = async (id: number, userId: number) => {
  const { photoPath, cvPath } = await findOwned(id, userId);
  await prisma.mentorProfile.delete({ where: { id } }); // 409 if bookings reference it
  await Promise.all([removeUpload(photoPath), removeUpload(cvPath)]);
};

// ---------------------------------------------------------------- files ----
const replaceFile = async (id: number, userId: number, field: 'photoPath' | 'cvPath', newPath: string) => {
  try {
    const previous = (await findOwned(id, userId))[field];
    await prisma.mentorProfile.update({ where: { id }, data: { [field]: newPath } });
    await removeUpload(previous);
  } catch (error) {
    await removeUpload(newPath); // do not leave orphan files behind on failure
    throw error;
  }
  return getById(id);
};

export const setPhoto = (id: number, userId: number, path: string) => replaceFile(id, userId, 'photoPath', path);
export const setCv = (id: number, userId: number, path: string) => replaceFile(id, userId, 'cvPath', path);

export const getCv = async (id: number) => {
  const mentor = await prisma.mentorProfile.findUnique({
    where: { id },
    select: { cvPath: true, user: { select: { firstName: true, lastName: true } } },
  });
  if (!mentor?.cvPath) throw AppError.notFound('This mentor has not uploaded a CV');
  const { firstName, lastName } = mentor.user;
  return { cvPath: mentor.cvPath, fileName: `${firstName}-${lastName}-CV.pdf`.replace(/[^\w.-]+/g, '-') };
};
