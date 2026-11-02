import { prisma } from '../../config/prisma.js';
import { fileUrl } from '../../middlewares/upload.js';
import { env } from '../../config/env.js';
import { getCalendarDays, toIsoDate } from './availability.service.js';
import { getOnboarding } from './profile.service.js';

const DAY_MS = 86_400_000;

interface BookingRow {
  id: number;
  status: 'PENDING' | 'CONFIRMED';
  scheduledAt: Date;
  service: string;
  durationMin: number;
  price: number;
  currency: string;
  mentorEarning: number;
  studentId: number;
  studentName: string;
}

interface Stats {
  totalStudents: number;
  oneOnOneSessions: number;
  totalMinutes: number;
  groupSessions: number;
  earnings: { currency: string; amount: number }[];
  topDays: { weekday: number; bookings: number }[];
}

const utcDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * DAY_MS);
const mondayOf = (date: Date) => addDays(date, -((date.getUTCDay() + 6) % 7));

/** Bookings the mentor received in [from, to) - "Your Sessions" and "Sessions | Booked". */
export const listBookings = (mentorId: number, from: Date, to: Date) =>
  prisma.$queryRaw<BookingRow[]>`
    SELECT * FROM fn_get_mentor_bookings(
      ${mentorId}::int,
      (${from.toISOString()}::timestamptz AT TIME ZONE 'UTC'),
      (${to.toISOString()}::timestamptz AT TIME ZONE 'UTC'))`;

/**
 * Mentor dashboard "Overview": profile link, availability warning, this month's stats,
 * upcoming sessions (next two months), weekly hours (next 4 weeks) and top student days.
 */
export const getOverview = async (userId: number, mentorId: number) => {
  const now = new Date();
  const today = utcDate(toIsoDate(now));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const firstWeek = mondayOf(today);
  const calendarEnd = addDays(firstWeek, 4 * 7 - 1);

  const [profile, onboarding, upcoming, days] = await Promise.all([
    prisma.mentorProfile.findUniqueOrThrow({
      where: { id: mentorId },
      select: { slug: true, status: true, photoPath: true, user: { select: { firstName: true, lastName: true, timezone: true } } },
    }),
    getOnboarding(userId),
    listBookings(mentorId, now, addDays(now, 62)),
    getCalendarDays(mentorId, toIsoDate(firstWeek), toIsoDate(calendarEnd)),
  ]);

  const [{ stats }] = await prisma.$queryRaw<{ stats: Stats }[]>`
    SELECT fn_get_mentor_stats(
      ${mentorId}::int, ${userId}::int,
      (${monthStart.toISOString()}::timestamptz AT TIME ZONE 'UTC'),
      (${monthEnd.toISOString()}::timestamptz AT TIME ZONE 'UTC'),
      ${profile.user.timezone}::text) AS stats`;

  const weeklyHours = Array.from({ length: 4 }, (_, week) => {
    const start = addDays(firstWeek, week * 7);
    const end = addDays(start, 6);
    const minutes = days
      .filter(({ date }) => date >= toIsoDate(start) && date <= toIsoDate(end))
      .reduce((sum, day) => sum + day.availableMinutes, 0);
    return { from: toIsoDate(start), to: toIsoDate(end), hours: Math.round((minutes / 60) * 10) / 10 };
  });
  const nextWeek = days.filter(({ date }) => date >= toIsoDate(today) && date <= toIsoDate(addDays(today, 6)));

  return {
    profile: {
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      status: profile.status,
      photoUrl: fileUrl(profile.photoPath),
      slug: profile.slug,
      profilePath: `/${profile.slug}`,
      profileUrl: `${env.APP_URL}/${profile.slug}`,
      timezone: profile.user.timezone,
      strength: onboarding.strength,
    },
    noAvailabilityNextWeek: !nextWeek.some((day) => day.availableMinutes > 0), // "Fix now" banner
    stats: {
      month: monthStart.toISOString().slice(0, 7),
      totalStudents: stats.totalStudents,
      earnings: stats.earnings, // grouped by currency (BDT / USD)
      totalHours: Math.round((stats.totalMinutes / 60) * 10) / 10,
      oneOnOneSessions: stats.oneOnOneSessions,
      groupSessions: stats.groupSessions,
    },
    upcoming,
    weeklyHours,
    topDays: stats.topDays, // weekday 0 = Sunday
  };
};
