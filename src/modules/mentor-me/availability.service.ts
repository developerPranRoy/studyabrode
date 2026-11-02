import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { toMinutes, type OneOffSlotInput, type WeeklyAvailabilityInput } from './mentor-me.schema.js';

const pad = (value: number) => String(value).padStart(2, '0');
const toClock = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
export const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

interface RuleRow {
  id: number;
  weekday: number | null;
  date: Date | null;
  startMinute: number;
  endMinute: number;
}

/** Weekly hours per weekday and one-off dates, in the mentor's time zone. */
export const getAvailability = async (mentorId: number) => {
  const [rules, profile] = await Promise.all([
    prisma.$queryRaw<RuleRow[]>`SELECT * FROM fn_get_mentor_availability_rules(${mentorId}::int)`,
    prisma.mentorProfile.findUniqueOrThrow({
      where: { id: mentorId },
      select: { availableFrom: true, availableUntil: true, user: { select: { timezone: true } } },
    }),
  ]);

  const weekly = new Map<number, { id: number; start: string; end: string }[]>();
  for (const rule of rules.filter((item) => item.weekday !== null)) {
    const ranges = weekly.get(rule.weekday!) ?? [];
    ranges.push({ id: rule.id, start: toClock(rule.startMinute), end: toClock(rule.endMinute) });
    weekly.set(rule.weekday!, ranges);
  }
  return {
    timezone: profile.user.timezone,
    availableFrom: profile.availableFrom && toIsoDate(profile.availableFrom),
    availableUntil: profile.availableUntil && toIsoDate(profile.availableUntil), // null = ongoing
    weekly: [...weekly.entries()].map(([weekday, ranges]) => ({ weekday, ranges })),
    oneOff: rules
      .filter((item) => item.date)
      .map((item) => ({ id: item.id, date: toIsoDate(item.date!), start: toClock(item.startMinute), end: toClock(item.endMinute) })),
  };
};

/** Replaces the weekly schedule (one-off dates are kept) and sets the time zone and end date. */
export const saveWeekly = async (mentorId: number, userId: number, { timezone, weekly, availableUntil }: WeeklyAvailabilityInput) => {
  const today = new Date(`${toIsoDate(new Date())}T00:00:00.000Z`);
  const until = availableUntil ? new Date(`${availableUntil}T00:00:00.000Z`) : null;
  if (until && until < today) throw AppError.badRequest('The availability end date is in the past', [{ field: 'availableUntil', message: 'Choose a future date' }]);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { timezone } }),
    prisma.mentorProfile.update({ where: { id: mentorId }, data: { availableFrom: today, availableUntil: until } }),
    prisma.availabilityRule.deleteMany({ where: { mentorId, weekday: { not: null } } }),
    prisma.availabilityRule.createMany({
      data: weekly.flatMap(({ weekday, ranges }) =>
        ranges.map(({ start, end }) => ({ mentorId, weekday, startMinute: toMinutes(start), endMinute: toMinutes(end) }))),
    }),
  ]);
};

export const addOneOffSlot = async (mentorId: number, { date, start, end }: OneOffSlotInput) => {
  if (date < toIsoDate(new Date())) throw AppError.badRequest('The date is in the past', [{ field: 'date', message: 'Choose today or a future date' }]);
  return prisma.availabilityRule.create({
    data: { mentorId, date: new Date(`${date}T00:00:00.000Z`), startMinute: toMinutes(start), endMinute: toMinutes(end) },
    select: { id: true },
  });
};

export const deleteOneOffSlot = async (mentorId: number, slotId: number) => {
  const { count } = await prisma.availabilityRule.deleteMany({ where: { id: slotId, mentorId, date: { not: null } } });
  if (!count) throw AppError.notFound('Slot not found');
};

/** "Clear all availability" / "Delete all schedules". */
export const clearAvailability = async (mentorId: number) => {
  await prisma.availabilityRule.deleteMany({ where: { mentorId } });
};

interface DayRow {
  day: Date;
  availableMinutes: number;
  bookedCount: number;
}

/** Calendar colouring: days with availability (orange) and days with bookings (red). */
export const getCalendarDays = async (mentorId: number, from: string, to: string) => {
  const rows = await prisma.$queryRaw<DayRow[]>`
    SELECT * FROM fn_get_mentor_availability_days(${mentorId}::int, ${from}::date, ${to}::date)`;
  return rows.map(({ day, availableMinutes, bookedCount }) => ({ date: toIsoDate(day), availableMinutes, bookedCount }));
};
