import { prisma } from '../../config/prisma.js';
import { encryptJson, maskValue } from '../../lib/crypto.js';
import { AppError } from '../../utils/AppError.js';
import type { PayoutInput } from './mentor-me.schema.js';

// The value shown as a hint is the first of these the method collected.
const HINT_FIELDS = ['accountNumber', 'mobileNumber', 'email'];

/** Only a masked hint is ever returned; the details themselves are encrypted at rest. */
export const getPayout = async (mentorId: number) => {
  const payout = await prisma.mentorPayout.findUnique({
    where: { mentorId },
    select: { maskedHint: true, confirmedAt: true, method: { select: { id: true, name: true, slug: true } } },
  });
  return payout && { method: payout.method, maskedHint: payout.maskedHint, confirmedAt: payout.confirmedAt };
};

export const savePayout = async (mentorId: number, { methodId, details }: PayoutInput) => {
  const method = await prisma.payoutMethod.findUnique({ where: { id: methodId } });
  if (!method) throw AppError.notFound('Payout method not found');

  const allowed = new Set([...method.requiredFields, ...method.optionalFields]);
  const problems = [
    ...method.requiredFields.filter((field) => !details[field]).map((field) => ({ field: `details.${field}`, message: 'Required' })),
    ...Object.keys(details).filter((field) => !allowed.has(field)).map((field) => ({ field: `details.${field}`, message: 'Not accepted for this method' })),
  ];
  if (problems.length) throw AppError.badRequest('Invalid payout details', problems);

  const hintSource = HINT_FIELDS.map((field) => details[field]).find(Boolean) ?? '';
  const data = { methodId, detailsEncrypted: encryptJson(details), maskedHint: maskValue(hintSource), confirmedAt: new Date() };
  await prisma.mentorPayout.upsert({ where: { mentorId }, update: data, create: { mentorId, ...data } });
  return getPayout(mentorId);
};
