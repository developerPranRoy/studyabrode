import { z } from 'zod';
import { idParams, idSchema, optional, slugSchema } from '../../utils/commonSchemas.js';
const SORTS = ['top_rated', 'most_sessions', 'price_asc'];
export const listQuery = z.object({
    country: optional(slugSchema),
    program: optional(slugSchema),
    scholarship: optional(slugSchema),
    service: optional(slugSchema), // service slug from GET /lookups/services, e.g. "40-min-call"
    search: optional(z.string().trim().max(80)), // mentor name or university
    sort: optional(z.enum(SORTS)),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
});
export const listSchema = { query: listQuery };
export const exportSchema = { query: listQuery.omit({ page: true, limit: true }) };
const planSchema = z.object({
    serviceId: idSchema, // a row of GET /lookups/services
    price: z.number().positive().max(10_000), // USD
});
const mentorBody = z.object({
    headline: z.string().trim().min(5).max(120),
    bio: z.string().trim().min(20).max(2000),
    countryId: idSchema,
    universityName: z.string().trim().min(2).max(200), // chosen from the external university API
    programId: idSchema,
    scholarshipId: idSchema.nullable().optional(),
    plans: z
        .array(planSchema)
        .min(1)
        .max(10)
        .refine((plans) => new Set(plans.map((plan) => plan.serviceId)).size === plans.length, 'Each service may appear only once'),
});
export const createMentorSchema = { body: mentorBody };
export const updateMentorSchema = { params: idParams.params, body: mentorBody };
//# sourceMappingURL=mentors.schema.js.map