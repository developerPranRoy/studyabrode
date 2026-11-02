import { z } from 'zod';
import { idSchema, idParam, optional } from '../../utils/commonSchemas.js';

export const countriesQuerySchema = {
  query: z.object({
    // "?regionIds=1,2" - limits countries to those regions (a "flexible" region matches all)
    regionIds: optional(
      z.string().regex(/^\d{1,10}(,\d{1,10})*$/).transform((value) => value.split(',').map(Number)).pipe(z.array(idSchema).max(10)),
    ),
    withMentors: optional(z.enum(['true', 'false']).transform((value) => value === 'true')),
  }),
};

export const universitiesQuerySchema = { query: z.object({ countryId: idParam }) };

export type CountriesQuery = z.infer<typeof countriesQuerySchema.query>;
