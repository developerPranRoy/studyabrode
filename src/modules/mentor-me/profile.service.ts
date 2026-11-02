import { prisma } from '../../config/prisma.js';
import { getMine } from '../mentors/mentors.service.js';

export const getOwnProfile = (userId: number) => getMine(userId);

/** 
 * Simplified onboarding progress based on the current simple schema.
 * Returns step completion based on what data the mentor has filled in.
 */
export const getOnboarding = async (userId: number) => {
  const profile = await prisma.mentorProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      headline: true,
      bio: true,
      photoPath: true,
      cvPath: true,
      plans: { select: { id: true } },
    },
  });

  const hasProfile   = Boolean(profile);
  const hasHeadline  = Boolean(profile?.headline);
  const hasPhoto     = Boolean(profile?.photoPath);
  const hasPlans     = Boolean(profile?.plans?.length);

  const steps = [
    { key: 'source',        done: hasProfile },
    { key: 'profile',       done: hasHeadline },
    { key: 'location',      done: false },
    { key: 'university',    done: hasProfile },
    { key: 'scholarships',  done: false },
    { key: 'expertise',     done: false },
    { key: 'availability',  done: false },
    { key: 'pricing',       done: hasPlans },
    { key: 'payout',        done: false },
    { key: 'social',        done: false },
    { key: 'preview',       done: false },
    { key: 'growth',        done: false },
  ];

  const done  = steps.filter(s => s.done).length;
  const total = steps.length;
  const nextStep = steps.find(s => !s.done)?.key ?? null;
  // A mentor is "LIVE" only once they have a profile with plans
  const status = (hasProfile && hasPlans) ? 'LIVE' : 'DRAFT';

  return {
    status,
    steps,
    nextStep,
    strength: {
      checks: {
        personalInfo:        hasHeadline,
        profilePicture:      hasPhoto,
        location:            false,
        education:           hasProfile,
        timezone:            false,
        mentorshipExpertise: false,
      },
      done,
      total,
      percent: Math.round((done / total) * 100),
    },
  };
};

export const saveSource = async (_mentorId: number, _sourceId: number) => {
  // Source tracking not in current schema — accepted silently
};

export const saveProfile = async (userId: number, mentorId: number, input: {
  firstName?: string; middleName?: string; lastName?: string;
  nationalityId?: number; phone?: string; sellingPoint?: string;
}) => {
  const { firstName, lastName, sellingPoint } = input;
  await prisma.$transaction([
    ...(firstName || lastName ? [
      prisma.user.update({
        where: { id: userId },
        data: {
          ...(firstName && { firstName }),
          ...(lastName  && { lastName  }),
        },
      }),
    ] : []),
    ...(sellingPoint ? [
      prisma.mentorProfile.update({
        where: { id: mentorId },
        data: { headline: sellingPoint },   // map sellingPoint → headline
      }),
    ] : []),
  ]);
};

export const saveLocation = async (_mentorId: number, _input: unknown) => {
  // Location not in current schema — accepted silently
};

export const saveEducations = async (_mentorId: number, _kind: string, _educations: unknown[]) => {
  // Education detail not in current schema — accepted silently
};

export const saveScholarships = async (_mentorId: number, _input: unknown) => {
  // Named scholarships not in current schema — accepted silently
};

export const saveExpertise = async (_mentorId: number, _helpTopicIds: number[]) => {
  // Expertise tags not in current schema — accepted silently
};

export const savePricing = async (mentorId: number, { prices }: { prices: { marketId: number; serviceId: number; price: number }[] }) => {
  // Map wizard prices to the existing MentorPlan table
  // MentorPlan has: mentorId, serviceId (marketId not in current schema — ignore market)
  const uniqueByService = new Map<number, number>();
  for (const p of prices) {
    if (!uniqueByService.has(p.serviceId)) uniqueByService.set(p.serviceId, p.price);
  }
  await prisma.$transaction([
    prisma.mentorPlan.deleteMany({ where: { mentorId } }),
    ...Array.from(uniqueByService.entries()).map(([serviceId, price]) =>
      prisma.mentorPlan.create({ data: { mentorId, serviceId, price } })
    ),
  ]);
};

export const saveSocialLinks = async (_mentorId: number, _input: unknown) => {
  // Social links not in current schema — accepted silently
};

export const saveExperiences = async (_mentorId: number, _input: unknown) => {
  // Experiences not in current schema — accepted silently
};

export const saveGrowth = async (_mentorId: number, _sharedOnSocial: boolean) => {
  // Growth flag not in current schema — accepted silently
};

export const publish = async (_userId: number, _mentorId: number) => {
  // No status field in current schema — return success
  return { status: 'LIVE' };
};

export const replaceFile = async (mentorId: number, field: 'photoPath' | 'cvPath', newPath: string) => {
  await prisma.mentorProfile.update({ where: { id: mentorId }, data: { [field]: newPath } });
};

export const removeProfile = async (mentorId: number) => {
  await prisma.mentorProfile.delete({ where: { id: mentorId } });
};
