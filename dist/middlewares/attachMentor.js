import { prisma } from '../config/prisma.js';
import { catchAsync } from '../utils/catchAsync.js';
/**
 * Resolves the logged-in mentor's profile id into req.mentorId.
 * If no profile exists yet, creates an empty draft so the wizard can proceed.
 * Run after `authenticate` + `authorize('MENTOR')`.
 */
export const attachMentor = catchAsync(async (req, _res, next) => {
    // Try to find an existing profile
    let profile = await prisma.mentorProfile.findUnique({
        where: { userId: req.user.id },
        select: { id: true },
    });
    // No profile yet — create an empty draft so the wizard steps can save
    if (!profile) {
        // We need required FK fields. Get the first available country, university, program.
        const [country, program] = await Promise.all([
            prisma.country.findFirst({ select: { id: true } }),
            prisma.program.findFirst({ select: { id: true } }),
        ]);
        const university = await prisma.university.findFirst({ select: { id: true } });
        if (country && program && university) {
            profile = await prisma.mentorProfile.create({
                data: {
                    userId: req.user.id,
                    headline: '',
                    bio: '',
                    countryId: country.id,
                    universityId: university.id,
                    programId: program.id,
                },
                select: { id: true },
            });
        }
    }
    if (!profile) {
        // Fallback — should not happen if DB has seed data
        const { AppError } = await import('../utils/AppError.js');
        throw AppError.notFound('Mentor profile not found and could not be created');
    }
    req.mentorId = profile.id;
    next();
});
//# sourceMappingURL=attachMentor.js.map