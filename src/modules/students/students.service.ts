import { prisma } from '../../config/prisma.js';
import { fileUrl } from '../../middlewares/upload.js';
import { AppError } from '../../utils/AppError.js';
import type { Onboarding } from './students.schema.js';

const DAY_MS = 86_400_000;

/** Builds the nested Prisma write for a student profile (used by sign-up and profile update). */
export const toProfileData = (o: Onboarding) => ({
  program: { connect: { id: o.programId } },
  budgetRange: { connect: { id: o.budgetRangeId } },
  fundingNeed: { connect: { id: o.fundingNeedId } },
  source: { connect: { id: o.sourceId } },
  workWhileStudying: o.workWhileStudying,
  stayAfterStudy: o.stayAfterStudy,
  ieltsTaken: o.ielts.taken,
  ieltsScore: o.ielts.taken ? o.ielts.score : null,
  applyMode: o.applyMode,
  countriesOther: o.countriesOther,
  fields: { create: o.fieldIds.map((fieldId) => ({ fieldId })) },
  regions: { create: o.regionIds.map((regionId) => ({ regionId })) },
  countries: { create: o.countryIds.map((countryId) => ({ countryId })) },
  helpTopics: { create: o.helpTopicIds.map((helpTopicId) => ({ helpTopicId })) },
});

// ------------------------------------------------------------- profile ----
interface Ref {
  id: number;
  name: string;
  slug?: string;
}

interface StudentProfileRow {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  timezone: string;
  emailVerified: boolean;
  referralCode: string;
  friendsJoined: number;
  createdAt: Date;
  onboarding: {
    program: Ref;
    fields: Ref[];
    regions: Ref[];
    countries: Ref[];
    countriesOther: boolean;
    budgetRange: Ref;
    fundingNeed: Ref;
    workWhileStudying: boolean;
    stayAfterStudy: 'YES' | 'NO' | 'NOT_ESSENTIAL';
    ielts: { taken: boolean; score: number | null };
    applyMode: 'SELF' | 'ASSISTED';
    helpTopics: Ref[];
    source: Ref;
  } | null;
}

export const getProfile = async (userId: number) => {
  const [profile] = await prisma.$queryRaw<StudentProfileRow[]>`
    SELECT * FROM fn_get_student_profile(${userId}::int)`;
  if (!profile) throw AppError.notFound('Student not found');
  return profile;
};

export const updateProfile = async (
  userId: number,
  { firstName, lastName, onboarding }: { firstName: string; lastName: string; onboarding: Onboarding },
) => {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { firstName, lastName, timezone: onboarding.timezone } });
    const existing = await tx.studentProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!existing) {
      await tx.studentProfile.create({ data: { ...toProfileData(onboarding), user: { connect: { id: userId } } } });
      return;
    }
    // Replace the multi-select answers: clear the join rows, then write the new ones.
    const where = { studentId: existing.id };
    await Promise.all([
      tx.studentField.deleteMany({ where }),
      tx.studentRegion.deleteMany({ where }),
      tx.studentCountry.deleteMany({ where }),
      tx.studentHelpTopic.deleteMany({ where }),
    ]);
    await tx.studentProfile.update({ where: { id: existing.id }, data: toProfileData(onboarding) });
  });
  return getProfile(userId);
};

export const updateTimezone = async (userId: number, timezone: string) => {
  await prisma.user.update({ where: { id: userId }, data: { timezone } });
  return { timezone };
};

// ------------------------------------------------------------ schedule ----
interface ScheduleRow {
  kind: 'ONE_ON_ONE' | 'GROUP';
  id: number;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  durationMin: number | null;
  counterpartName: string;
  counterpartPhotoPath: string | null;
  location: string | null;
}

interface ScheduleRange {
  from: Date;
  to: Date;
  type?: 'ONE_ON_ONE' | 'GROUP';
}

/** 1:1 bookings (not withdrawn) + registered group sessions in [from, to). */
export const getSchedule = async (studentId: number, { from, to, type }: ScheduleRange) => {
  const rows = await prisma.$queryRaw<ScheduleRow[]>`
    SELECT * FROM fn_get_student_schedule(
      ${studentId}::int,
      (${from.toISOString()}::timestamptz AT TIME ZONE 'UTC'),
      (${to.toISOString()}::timestamptz AT TIME ZONE 'UTC'),
      ${type ?? null}::text
    )`;
  return rows.map(({ counterpartPhotoPath, ...row }) => ({
    ...row,
    counterpartPhotoUrl: fileUrl(counterpartPhotoPath),
  }));
};

/** Dashboard "Overview": profile header + referral stats + what's coming up (next 12 months). */
export const getOverview = async (userId: number) => {
  const now = new Date();
  const [profile, upcoming] = await Promise.all([
    getProfile(userId),
    getSchedule(userId, { from: now, to: new Date(now.getTime() + 365 * DAY_MS) }),
  ]);
  return {
    profile,
    upcoming,
    counts: {
      all: upcoming.length,
      group: upcoming.filter((item) => item.kind === 'GROUP').length,
      oneOnOne: upcoming.filter((item) => item.kind === 'ONE_ON_ONE').length,
    },
  };
};

// ------------------------------------------------------- saved mentors ----
export const saveMentor = async (studentId: number, mentorId: number) => {
  await prisma.savedMentor.createMany({ data: [{ studentId, mentorId }], skipDuplicates: true });
};

export const unsaveMentor = async (studentId: number, mentorId: number) => {
  await prisma.savedMentor.deleteMany({ where: { studentId, mentorId } });
};
