import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

/** Resolves the logged-in mentor's profile id into req.mentorId. Run after `authenticate`. */
export const attachMentor = catchAsync(async (req, _res, next) => {
  const profile = await prisma.mentorProfile.findUnique({ where: { userId: req.user!.id }, select: { id: true } });
  if (!profile) throw AppError.notFound('Mentor profile not found');
  req.mentorId = profile.id;
  next();
});
