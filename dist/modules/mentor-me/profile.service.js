import { prisma } from '../../config/prisma.js';
import { getMine } from '../mentors/mentors.service.js';
export const getOwnProfile = (userId) => getMine(userId);
/**
 * Simplified onboarding progress based on the current simple schema.
 * Returns step completion based on what data the mentor has filled in.
 */
export const getOnboarding = async (userId) => {
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
    const hasProfile = Boolean(profile);
    const hasHeadline = Boolean(profile?.headline);
    const hasPhoto = Boolean(profile?.photoPath);
    const hasPlans = Boolean(profile?.plans?.length);
    const steps = [
        { key: 'source', done: hasProfile },
        { key: 'profile', done: hasHeadline },
        { key: 'location', done: false },
        { key: 'university', done: hasProfile },
        { key: 'scholarships', done: false },
        { key: 'expertise', done: false },
        { key: 'availability', done: false },
        { key: 'pricing', done: hasPlans },
        { key: 'payout', done: false },
        { key: 'social', done: false },
        { key: 'preview', done: false },
        { key: 'growth', done: false },
    ];
    const done = steps.filter(s => s.done).length;
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
                personalInfo: hasHeadline,
                profilePicture: hasPhoto,
                location: false,
                education: hasProfile,
                timezone: false,
                mentorshipExpertise: false,
            },
            done,
            total,
            percent: Math.round((done / total) * 100),
        },
    };
};
export const saveSource = async (_mentorId, _sourceId) => {
    // Source tracking not in current schema — accepted silently
};
export const saveProfile = async (userId, mentorId, input) => {
    const { firstName, lastName, sellingPoint } = input;
    await prisma.$transaction([
        ...(firstName || lastName ? [
            prisma.user.update({
                where: { id: userId },
                data: {
                    ...(firstName && { firstName }),
                    ...(lastName && { lastName }),
                },
            }),
        ] : []),
        ...(sellingPoint ? [
            prisma.mentorProfile.update({
                where: { id: mentorId },
                data: { headline: sellingPoint }, // map sellingPoint → headline
            }),
        ] : []),
    ]);
};
export const saveLocation = async (_mentorId, _input) => {
    // Location not in current schema — accepted silently
};
export const saveEducations = async (_mentorId, _kind, _educations) => {
    // Education detail not in current schema — accepted silently
};
export const saveScholarships = async (_mentorId, _input) => {
    // Named scholarships not in current schema — accepted silently
};
export const saveExpertise = async (_mentorId, _helpTopicIds) => {
    // Expertise tags not in current schema — accepted silently
};
export const savePricing = async (mentorId, { prices }) => {
    // Map wizard prices to the existing MentorPlan table
    // MentorPlan has: mentorId, serviceId (marketId not in current schema — ignore market)
    const uniqueByService = new Map();
    for (const p of prices) {
        if (!uniqueByService.has(p.serviceId))
            uniqueByService.set(p.serviceId, p.price);
    }
    await prisma.$transaction([
        prisma.mentorPlan.deleteMany({ where: { mentorId } }),
        ...Array.from(uniqueByService.entries()).map(([serviceId, price]) => prisma.mentorPlan.create({ data: { mentorId, serviceId, price } })),
    ]);
};
export const saveSocialLinks = async (_mentorId, _input) => {
    // Social links not in current schema — accepted silently
};
export const saveExperiences = async (_mentorId, _input) => {
    // Experiences not in current schema — accepted silently
};
export const saveGrowth = async (_mentorId, _sharedOnSocial) => {
    // Growth flag not in current schema — accepted silently
};
export const publish = async (_userId, _mentorId) => {
    // No status field in current schema — return success
    return { status: 'LIVE' };
};
export const replaceFile = async (mentorId, field, newPath) => {
    await prisma.mentorProfile.update({ where: { id: mentorId }, data: { [field]: newPath } });
};
export const removeProfile = async (mentorId) => {
    await prisma.mentorProfile.delete({ where: { id: mentorId } });
};
//# sourceMappingURL=profile.service.js.map