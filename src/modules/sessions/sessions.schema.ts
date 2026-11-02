import { z } from 'zod';
import { idParams, idSchema, optional, slugSchema } from '../../utils/commonSchemas.js';

export const listSessionsSchema = {
  query: z.object({
    tab: z.enum(['all', 'upcoming', 'past']).default('all'),
    category: optional(slugSchema), // category slug from GET /lookups/session-categories
  }),
};

const sessionFields = z.object({
  title: z.string().trim().min(5).max(150),
  description: z.string().trim().min(20).max(2000),
  categoryId: idSchema,
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  location: z.string().trim().min(2).max(100).default('Online'),
});

type SessionFields = z.infer<typeof sessionFields>;

const endsAfterStart = (s: SessionFields) => s.endsAt > s.startsAt;
const endsAfterStartIssue = { message: 'endsAt must be after startsAt', path: ['endsAt'] };

export const createSessionSchema = {
  body: sessionFields
    .refine(endsAfterStart, endsAfterStartIssue)
    .refine((s) => s.startsAt > new Date(), { message: 'startsAt must be in the future', path: ['startsAt'] }),
};

export const updateSessionSchema = {
  params: idParams.params,
  body: sessionFields.refine(endsAfterStart, endsAfterStartIssue),
};

export type SessionInput = SessionFields;
export type ListSessionsQuery = z.infer<typeof listSessionsSchema.query>;
