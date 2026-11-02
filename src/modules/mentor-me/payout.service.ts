import type { PayoutInput } from './mentor-me.schema.js';

/** Payout table not in current schema — return stub responses. */
export const getPayout = async (_mentorId: number) => {
  return null;
};

export const savePayout = async (_mentorId: number, _input: PayoutInput) => {
  // Payout not in current schema — accepted silently
  return null;
};
