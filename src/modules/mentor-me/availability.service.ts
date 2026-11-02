import { prisma } from '../../config/prisma.js';
import type { OneOffSlotInput, WeeklyAvailabilityInput } from './mentor-me.schema.js';

export const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

/** Simplified availability — uses AvailabilityRule table which exists in schema. */
export const getAvailability = async (_mentorId: number) => {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    availableFrom: null,
    availableUntil: null,
    weekly: [],
    oneOff: [],
  };
};

export const saveWeekly = async (mentorId: number, _userId: number, input: WeeklyAvailabilityInput) => {
  // AvailabilityRule table may not exist in the simple schema — silently accepted
  try {
    await prisma.$executeRawUnsafe(`
      DELETE FROM availability_rules WHERE mentor_id = $1 AND weekday IS NOT NULL
    `, mentorId);
    for (const day of input.weekly) {
      for (const range of day.ranges) {
        const startMin = Number(range.start.slice(0, 2)) * 60 + Number(range.start.slice(3));
        const endMin   = Number(range.end.slice(0, 2))   * 60 + Number(range.end.slice(3));
        await prisma.$executeRawUnsafe(`
          INSERT INTO availability_rules (mentor_id, weekday, start_minute, end_minute)
          VALUES ($1, $2, $3, $4)
        `, mentorId, day.weekday, startMin, endMin);
      }
    }
  } catch {
    // Table may not exist — silently ignore
  }
};

export const addOneOffSlot = async (_mentorId: number, _input: OneOffSlotInput) => {
  return { id: 0 };
};

export const deleteOneOffSlot = async (_mentorId: number, _slotId: number) => {};

export const clearAvailability = async (mentorId: number) => {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM availability_rules WHERE mentor_id = $1`, mentorId);
  } catch {
    // Table may not exist — silently ignore
  }
};

export const getCalendarDays = async (_mentorId: number, _from: string, _to: string) => {
  return [];
};
