import { prisma } from '../../config/prisma.js';
import { fileUrl } from '../../middlewares/upload.js';

/** Simplified overview using only fields in the current simple schema. */
export const getOverview = async (userId: number, mentorId: number) => {
  const now = new Date();

  const profile = await prisma.mentorProfile.findUniqueOrThrow({
    where: { id: mentorId },
    select: {
      photoPath: true,
      headline: true,
      user: { select: { firstName: true, lastName: true } },
    },
  });

  // Upcoming bookings in next 62 days — simple schema has studentId not a student relation
  const bookings = await prisma.booking.findMany({
    where: {
      mentorId,
      scheduledAt: { gte: now, lte: new Date(now.getTime() + 62 * 86_400_000) },
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
    select: {
      id: true,
      scheduledAt: true,
      status: true,
      priceAtBooking: true,
      studentId: true,
    },
    orderBy: { scheduledAt: 'asc' },
    take: 20,
  });

  return {
    profile: {
      firstName:  profile.user.firstName,
      lastName:   profile.user.lastName,
      photoUrl:   fileUrl(profile.photoPath),
      headline:   profile.headline,
      status:     'LIVE',
      slug:       null,
      profileUrl: null,
      strength: {
        percent: 50,
        done: 2,
        total: 4,
        checks: {
          personalInfo:        Boolean(profile.headline),
          profilePicture:      Boolean(profile.photoPath),
          location:            false,
          education:           true,
          timezone:            false,
          mentorshipExpertise: false,
        },
      },
    },
    noAvailabilityNextWeek: false,
    stats: {
      month:            now.toISOString().slice(0, 7),
      totalStudents:    0,
      earnings:         [],
      totalHours:       0,
      oneOnOneSessions: 0,
      groupSessions:    0,
    },
    upcoming: bookings.map((b) => ({
      id:          b.id,
      scheduledAt: b.scheduledAt.toISOString(),
      status:      b.status,
      earning:     b.priceAtBooking ? Number(b.priceAtBooking) : null,
      studentName: `Student #${b.studentId}`,
    })),
    weeklyHours: [],
    topDays:     [],
  };
};

export const listBookings = async (mentorId: number, from: Date, to: Date) => {
  const bookings = await prisma.booking.findMany({
    where: {
      mentorId,
      scheduledAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      scheduledAt: true,
      status: true,
      priceAtBooking: true,
      studentId: true,
    },
    orderBy: { scheduledAt: 'asc' },
  });

  return bookings.map((b) => ({
    id:          b.id,
    scheduledAt: b.scheduledAt.toISOString(),
    status:      b.status,
    earning:     b.priceAtBooking ? Number(b.priceAtBooking) : null,
    studentName: `Student #${b.studentId}`,
  }));
};
