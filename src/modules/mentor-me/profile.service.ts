import { prisma } from '../../config/prisma.js';
import { notify } from '../../lib/notifications.js';
import { removeUpload } from '../../middlewares/upload.js';
import { AppError } from '../../utils/AppError.js';
import { getMine as getProfile } from '../mentors/mentors.service.js';
import type {
  EducationInput, ExperiencesInput, LocationInput, PricingInput, ProfileInput, ScholarshipsInput, SocialInput,
} from './mentor-me.schema.js';

// ----------------------------------------------------------- progress ----
interface Onboarding {
  status: 'DRAFT' | 'LIVE';
  steps: { key: string; done: boolean }[];
  strength: Record<string, boolean>;
}

/** Wizard progress, derived from the stored data (so it can never drift), plus profile strength. */
export const getOnboarding = async (userId: number) => {
  const [row] = await prisma.$queryRaw<{ onboarding: Onboarding }[]>`
    SELECT fn_get_mentor_onboarding(${userId}::int) AS onboarding`;
  const { status, steps, strength } = row.onboarding;
  const checks = Object.values(strength);
  return {
    status,
    steps,
    nextStep: steps.find((step) => !step.done)?.key ?? null,
    strength: {
      checks: strength,
      done: checks.filter(Boolean).length,
      total: checks.length,
      percent: Math.round((checks.filter(Boolean).length / checks.length) * 100),
    },
  };
};

export const getOwnProfile = (userId: number) => getProfile(userId);

// -------------------------------------------------------------- steps ----
export const saveSource = async (mentorId: number, sourceId: number) => {
  await prisma.mentorProfile.update({ where: { id: mentorId }, data: { sourceId } });
};

export const saveProfile = async (userId: number, mentorId: number, input: ProfileInput) => {
  const { firstName, lastName, middleName, nationalityId, phone, sellingPoint, photoCrop } = input;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { firstName, lastName } }),
    prisma.mentorProfile.update({
      where: { id: mentorId },
      data: { middleName: middleName ?? null, nationalityId, phone: phone ?? null, sellingPoint, photoCrop },
    }),
  ]);
};

export const saveLocation = async (mentorId: number, { current, permanent }: LocationInput) => {
  await prisma.mentorProfile.update({
    where: { id: mentorId },
    data: {
      currentStreet: current.street ?? null,
      currentCity: current.city,
      currentCountryId: current.countryId,
      permanentSameAsCurrent: permanent.sameAsCurrent,
      permanentStreet: permanent.sameAsCurrent ? null : permanent.address.street ?? null,
      permanentCity: permanent.sameAsCurrent ? null : permanent.address.city,
      permanentCountryId: permanent.sameAsCurrent ? null : permanent.address.countryId,
    },
  });
};

/**
 * Replaces one kind of education. ABROAD entries must be outside the mentor's own country
 * (own-country education is BACKGROUND), and a graduation year is required unless the status is "current".
 */
export const saveEducations = async (mentorId: number, kind: 'ABROAD' | 'BACKGROUND', educations: EducationInput[]) => {
  const [mentor, statuses] = await Promise.all([
    prisma.mentorProfile.findUniqueOrThrow({ where: { id: mentorId }, select: { nationalityId: true } }),
    prisma.educationStatus.findMany(),
  ]);
  educations.forEach((education, index) => {
    const status = statuses.find((item) => item.id === education.statusId);
    if (!status) throw AppError.badRequest('Unknown education status', [{ field: `educations.${index}.statusId`, message: 'Unknown status' }]);
    if (status.isCurrent && education.graduationYear) {
      throw AppError.badRequest('Graduation year is not applicable while studying', [{ field: `educations.${index}.graduationYear`, message: 'Remove it for a current degree' }]);
    }
    if (!status.isCurrent && !education.graduationYear) {
      throw AppError.badRequest('Graduation year is required', [{ field: `educations.${index}.graduationYear`, message: 'Required for a finished degree' }]);
    }
    if (kind === 'ABROAD' && mentor.nationalityId === education.countryId) {
      throw AppError.badRequest('Own-country education belongs under Background', [{ field: `educations.${index}.countryId`, message: 'Choose a university abroad' }]);
    }
  });

  await prisma.$transaction(async (tx) => {
    await tx.mentorEducation.deleteMany({ where: { mentorId, kind } });
    for (const [sortOrder, e] of educations.entries()) {
      await tx.mentorEducation.create({
        data: {
          kind, sortOrder,
          mentor: { connect: { id: mentorId } },
          university: {
            connectOrCreate: {
              where: { name_countryId: { name: e.universityName, countryId: e.countryId } },
              create: { name: e.universityName, countryId: e.countryId },
            },
          },
          status: { connect: { id: e.statusId } },
          program: { connect: { id: e.programId } },
          fieldOfStudy: e.fieldOfStudy,
          admissionYear: e.admissionYear,
          graduationYear: e.graduationYear ?? null,
          city: e.city ?? null,
          scholarshipNote: e.scholarshipNote ?? null,
        },
      });
    }
  });
};

export const saveScholarships = async (mentorId: number, { noScholarshipProgram, programs }: ScholarshipsInput) => {
  await prisma.$transaction([
    prisma.mentorProfile.update({ where: { id: mentorId }, data: { noScholarshipProgram } }),
    prisma.mentorScholarship.deleteMany({ where: { mentorId } }),
    prisma.mentorScholarship.createMany({ data: programs.map((program) => ({ ...program, mentorId })) }),
  ]);
};

export const saveExpertise = async (mentorId: number, helpTopicIds: number[]) => {
  await prisma.$transaction([
    prisma.mentorExpertise.deleteMany({ where: { mentorId } }),
    prisma.mentorExpertise.createMany({ data: helpTopicIds.map((helpTopicId) => ({ mentorId, helpTopicId })) }),
  ]);
};

/** Replaces the mentor's prices. Prices that already have bookings cannot be removed (409). */
export const savePricing = async (mentorId: number, { prices }: PricingInput) => {
  await prisma.$transaction([
    prisma.mentorPlan.deleteMany({
      where: { mentorId, NOT: { OR: prices.map(({ marketId, serviceId }) => ({ marketId, serviceId })) } },
    }),
    ...prices.map(({ marketId, serviceId, price }) =>
      prisma.mentorPlan.upsert({
        where: { mentorId_serviceId_marketId: { mentorId, serviceId, marketId } },
        update: { price },
        create: { mentorId, serviceId, marketId, price },
      })),
  ]);
};

/** Every link must belong to its platform (hostname check against the platform's domains in the DB). */
export const saveSocialLinks = async (mentorId: number, { links }: SocialInput) => {
  const platforms = await prisma.socialPlatform.findMany({ where: { id: { in: links.map((link) => link.platformId) } } });
  links.forEach(({ platformId, url }, index) => {
    const platform = platforms.find((item) => item.id === platformId);
    const { protocol, hostname } = new URL(url);
    const hostOk = platform?.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    if (!platform || !hostOk || !['http:', 'https:'].includes(protocol)) {
      throw AppError.badRequest('Invalid social link', [{ field: `links.${index}.url`, message: `Enter a valid ${platform?.name ?? 'platform'} link` }]);
    }
  });
  await prisma.$transaction([
    prisma.mentorSocialLink.deleteMany({ where: { mentorId } }),
    prisma.mentorSocialLink.createMany({ data: links.map((link) => ({ ...link, mentorId })) }),
  ]);
};

export const saveExperiences = async (mentorId: number, { experiences }: ExperiencesInput) => {
  await prisma.$transaction([
    prisma.mentorExperience.deleteMany({ where: { mentorId } }),
    prisma.mentorExperience.createMany({ data: experiences.map((experience) => ({ ...experience, mentorId })) }),
  ]);
};

export const saveGrowth = async (mentorId: number, sharedOnSocial: boolean) => {
  await prisma.mentorProfile.update({ where: { id: mentorId }, data: { sharedOnSocial } });
};

// ------------------------------------------------------------ publish ----
const PUBLISH_STEPS = ['source', 'profile', 'location', 'university', 'scholarships', 'expertise', 'availability', 'pricing', 'payout', 'social'];

/** "Preview Profile -> Continue": goes live once steps 1-10 are complete and the email is verified. */
export const publish = async (userId: number, mentorId: number) => {
  const [{ steps }, user] = await Promise.all([
    getOnboarding(userId),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { emailVerifiedAt: true } }),
  ]);
  const missing = steps.filter((step) => PUBLISH_STEPS.includes(step.key) && !step.done).map((step) => step.key);
  if (missing.length) throw AppError.badRequest('Complete every step before publishing', missing.map((key) => ({ field: key, message: 'Step not completed' })));
  if (!user.emailVerifiedAt) throw AppError.forbidden('Verify your email to publish your profile', 'EMAIL_NOT_VERIFIED');

  await prisma.$transaction(async (tx) => {
    await tx.mentorProfile.update({ where: { id: mentorId }, data: { status: 'LIVE' } });
    await notify(tx, { userId, type: 'ACCOUNT', title: 'Your mentor profile is live', body: 'Students can now find and book you.' });
  });
  return getOwnProfile(userId);
};

// -------------------------------------------------------------- files ----
export const replaceFile = async (mentorId: number, field: 'photoPath' | 'cvPath', newPath: string) => {
  try {
    const current = await prisma.mentorProfile.findUniqueOrThrow({ where: { id: mentorId }, select: { photoPath: true, cvPath: true } });
    await prisma.mentorProfile.update({ where: { id: mentorId }, data: { [field]: newPath } });
    await removeUpload(current[field]);
  } catch (error) {
    await removeUpload(newPath); // do not leave orphan files behind on failure
    throw error;
  }
};

export const removeProfile = async (mentorId: number) => {
  const { photoPath, cvPath } = await prisma.mentorProfile.findUniqueOrThrow({ where: { id: mentorId }, select: { photoPath: true, cvPath: true } });
  await prisma.mentorProfile.delete({ where: { id: mentorId } }); // 409 if bookings reference it
  await Promise.all([removeUpload(photoPath), removeUpload(cvPath)]);
};
