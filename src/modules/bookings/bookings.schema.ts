import { z } from 'zod';
import { idSchema } from '../../utils/commonSchemas.js';

export const createBookingSchema = {
  body: z.object({
    planId: idSchema,
    scheduledAt: z.coerce.date().refine((date) => date > new Date(), 'scheduledAt must be in the future'),
  }),
};

export type CreateBookingInput = z.infer<typeof createBookingSchema.body>;
