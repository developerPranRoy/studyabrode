import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';

// ----------------------------------------------- database lookups (all via stored functions) ----
export interface Country {
  id: number;
  name: string;
  slug: string;
  title: string;
  description: string;
  regionId: number;
  mentorCount: number;
}

interface Option {
  id: number;
  name: string;
  slug: string;
}

interface Scholarship extends Option {
  region: string;
  title: string;
  description: string;
}

export interface Service extends Option {
  durationMin: number;
}

export const getCountries = ({ slug = null, regionIds = null, withMentors = false }: {
  slug?: string | null;
  regionIds?: number[] | null;
  withMentors?: boolean;
} = {}) =>
  prisma.$queryRaw<Country[]>`
    SELECT * FROM fn_get_countries(${slug}::text, ${regionIds}::int[], ${withMentors}::boolean)`;

export const getPrograms = () => prisma.$queryRaw<Option[]>`SELECT * FROM fn_get_programs()`;
export const getScholarships = (slug: string | null = null) =>
  prisma.$queryRaw<Scholarship[]>`SELECT * FROM fn_get_scholarships(${slug}::text)`;
export const getServices = () => prisma.$queryRaw<Service[]>`SELECT * FROM fn_get_services()`;
export const getSessionCategories = () => prisma.$queryRaw<Option[]>`SELECT * FROM fn_get_session_categories()`;

/** All option lists of the onboarding questionnaire in one call. */
export const getOnboardingOptions = async () => {
  const [row] = await prisma.$queryRaw<{ options: unknown }[]>`SELECT fn_get_onboarding_options() AS options`;
  return row.options;
};

/** Time zones known to the runtime's tz database (no static list in the code). */
export const getTimezones = () => Intl.supportedValuesOf('timeZone');

const firstOrNotFound = async <T>(rows: Promise<T[]>, label: string): Promise<T> => {
  const [row] = await rows;
  if (!row) throw AppError.notFound(`${label} not found`);
  return row;
};

export const getCountryBySlug = (slug: string) => firstOrNotFound(getCountries({ slug }), 'Country');
export const getScholarshipBySlug = (slug: string) => firstOrNotFound(getScholarships(slug), 'Scholarship');

// ---------------------------------------- external university list (proxied + cached) ----
// Proxying avoids browser CORS / mixed-content (the provider is HTTP-only) and keeps us within
// the free API's limits. Cache keys are bounded because they come from our countries table.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const universityCache = new Map<number, { data: { name: string; website: string | null }[]; expiresAt: number }>();

interface UpstreamUniversity {
  name: string;
  web_pages?: string[];
}

export const getUniversitiesByCountry = async (countryId: number) => {
  const country = (await getCountries()).find(({ id }) => id === countryId);
  if (!country) throw AppError.notFound('Country not found');

  const cached = universityCache.get(country.id);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const url = new URL(env.UNIVERSITY_API_URL);
  url.searchParams.set('country', country.name);

  let rows: UpstreamUniversity[];
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Upstream status ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error('Unexpected upstream payload');
    rows = payload as UpstreamUniversity[];
  } catch (error) {
    console.error('University API error:', error instanceof Error ? error.message : error);
    throw new AppError('University service is currently unavailable', 502);
  }

  const unique = new Map(rows.map(({ name, web_pages: pages }) => [name, { name, website: pages?.[0] ?? null }]));
  const data = [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  universityCache.set(country.id, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
};
