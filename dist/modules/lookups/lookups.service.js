import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
export const getCountries = ({ slug = null, regionIds = null, withMentors = false } = {}) => prisma.$queryRaw `
    SELECT * FROM fn_get_countries(${slug}::text, ${regionIds}::int[], ${withMentors}::boolean)`;
export const getPrograms = () => prisma.$queryRaw `SELECT * FROM fn_get_programs()`;
export const getScholarships = (slug = null) => prisma.$queryRaw `SELECT * FROM fn_get_scholarships(${slug}::text)`;
export const getServices = () => prisma.$queryRaw `SELECT * FROM fn_get_services()`;
export const getSessionCategories = () => prisma.$queryRaw `SELECT * FROM fn_get_session_categories()`;
/** All option lists of the onboarding questionnaire in one call. */
export const getOnboardingOptions = async () => {
    const [row] = await prisma.$queryRaw `SELECT fn_get_onboarding_options() AS options`;
    return row.options;
};
/** Time zones known to the runtime's tz database (no static list in the code). */
export const getTimezones = () => Intl.supportedValuesOf('timeZone');
const firstOrNotFound = async (rows, label) => {
    const [row] = await rows;
    if (!row)
        throw AppError.notFound(`${label} not found`);
    return row;
};
export const getCountryBySlug = (slug) => firstOrNotFound(getCountries({ slug }), 'Country');
export const getScholarshipBySlug = (slug) => firstOrNotFound(getScholarships(slug), 'Scholarship');
// ---------------------------------------- external university list (proxied + cached) ----
// Proxying avoids browser CORS / mixed-content (the provider is HTTP-only) and keeps us within
// the free API's limits. Cache keys are bounded because they come from our countries table.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const universityCache = new Map();
export const getUniversitiesByCountry = async (countryId) => {
    const country = (await getCountries()).find(({ id }) => id === countryId);
    if (!country)
        throw AppError.notFound('Country not found');
    const cached = universityCache.get(country.id);
    if (cached && cached.expiresAt > Date.now())
        return cached.data;
    const url = new URL(env.UNIVERSITY_API_URL);
    url.searchParams.set('country', country.name);
    let rows;
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!response.ok)
            throw new Error(`Upstream status ${response.status}`);
        const payload = await response.json();
        if (!Array.isArray(payload))
            throw new Error('Unexpected upstream payload');
        rows = payload;
    }
    catch (error) {
        console.error('University API error:', error instanceof Error ? error.message : error);
        throw new AppError('University service is currently unavailable', 502);
    }
    const unique = new Map(rows.map(({ name, web_pages: pages }) => [name, { name, website: pages?.[0] ?? null }]));
    const data = [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
    universityCache.set(country.id, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
};
/** Mentor wizard option lists — sources, education statuses, scholarships, help topics, etc. */
export const getMentorOnboardingOptions = async () => {
    const [programs, scholarships, sources, services, helpTopics] = await Promise.all([
        getPrograms(),
        getScholarships(),
        getOnboardingOptions().then((opts) => opts?.sources ?? []),
        getServices(),
        getOnboardingOptions().then((opts) => opts?.helpTopics ?? []),
    ]);
    return {
        sources,
        programs,
        scholarships,
        services,
        helpTopics,
        educationStatuses: [
            { id: 1, name: 'Currently studying', slug: 'current', isCurrent: true },
            { id: 2, name: 'Graduated', slug: 'graduated', isCurrent: false },
        ],
        socialPlatforms: [
            { id: 1, name: 'LinkedIn', slug: 'linkedin', domains: ['linkedin.com', 'www.linkedin.com'] },
            { id: 2, name: 'Facebook', slug: 'facebook', domains: ['facebook.com', 'www.facebook.com'] },
            { id: 3, name: 'Instagram', slug: 'instagram', domains: ['instagram.com', 'www.instagram.com'] },
            { id: 4, name: 'Twitter/X', slug: 'twitter', domains: ['twitter.com', 'x.com', 'www.twitter.com'] },
            { id: 5, name: 'YouTube', slug: 'youtube', domains: ['youtube.com', 'www.youtube.com'] },
            { id: 6, name: 'Website', slug: 'website', domains: [] },
        ],
        payoutMethods: [
            { id: 1, name: 'Bank Transfer', slug: 'bank', requiredFields: ['accountHolderName', 'bankName', 'accountNumber', 'swift', 'bankCountry'], optionalFields: ['branchName', 'branchAddress'] },
            { id: 2, name: 'PayPal', slug: 'paypal', requiredFields: ['email'], optionalFields: [] },
            { id: 3, name: 'Wise', slug: 'wise', requiredFields: ['email'], optionalFields: ['accountHolderName'] },
            { id: 4, name: 'Payoneer', slug: 'payoneer', requiredFields: ['email'], optionalFields: [] },
            { id: 5, name: 'bKash', slug: 'bkash', requiredFields: ['mobileNumber'], optionalFields: ['accountHolderName'] },
        ],
        pricingMarkets: [
            { id: 1, name: 'Bangladesh Students', slug: 'bd', currency: 'BDT', platformFeePercent: 30, recommended: { 20: 900, 40: 1800 } },
            { id: 2, name: 'International Students', slug: 'intl', currency: 'USD', platformFeePercent: 30, recommended: { 20: 25, 40: 40 } },
        ],
    };
};
/** Pricing markets (also returned inside getMentorOnboardingOptions). */
export const getPricingMarkets = () => [
    { id: 1, name: 'Bangladesh Students', slug: 'bd', currency: 'BDT', platformFeePercent: 30 },
    { id: 2, name: 'International Students', slug: 'intl', currency: 'USD', platformFeePercent: 30 },
];
//# sourceMappingURL=lookups.service.js.map