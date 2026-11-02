// Idempotent demo data: safe to run repeatedly. Demo password for every account: Password123
// This is the ONLY place reference data is written; the API itself never hard-codes option lists.
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma.js';

const DEMO_PASSWORD = 'Password123';
const DAY_MS = 86_400_000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

const slugify = (text: string) =>
  text.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-');

const named = (names: string[]) => names.map((name, index) => ({ name, slug: slugify(name), sortOrder: index }));

// ----------------------------------------------------- onboarding options ----
const PROGRAMS = ["Bachelor's", "Master's", 'PhD', 'Diploma'];

const FIELDS = [
  'Agriculture, Food & Forestry', 'Arts, Design, Media & Architecture', 'Business, Management & Economics',
  'Computer Science, IT & Data', 'Creative Industries & Communication', 'Education, Teaching & Training',
  'Engineering & Technology', 'Environmental Science & Sustainability', 'Health, Medicine & Life Sciences',
  'Hospitality, Tourism & Sports', 'Humanities, Languages & Culture', 'Interdisciplinary / Not Sure Yet',
  'Law, Policy & Governance', 'Natural Sciences & Mathematics', 'Social Sciences & International Relations',
  'Other / Not listed',
];

const REGIONS = ['Europe', 'North America', 'Asia', 'Oceania'];
const FLEXIBLE_REGION = "I'm flexible!";

const BUDGET_RANGES = [
  { name: 'Under $10,000 / year', minUsd: 0, maxUsd: 10_000 },
  { name: '$10,000 – $25,000 / year', minUsd: 10_000, maxUsd: 25_000 },
  { name: '$25,000 – $50,000 / year', minUsd: 25_000, maxUsd: 50_000 },
  { name: '$50,000+ / year', minUsd: 50_000, maxUsd: null },
];

const FUNDING_NEEDS = ['Need full scholarship', 'Need partial funding', 'Self-funded', 'Flexible / Not sure'];

const HELP_TOPICS = [
  'Essay Review', 'Test Prep', 'Roadmap', 'University Application', 'Scholarships', 'Life Abroad',
  'Visa Application', 'Abroad Career', 'ECA Guidance', 'Mock Interviews', 'Personal Statement',
  'Resume Review', 'Recommendation Letters',
];

const SOURCES = [
  'Facebook Reel', 'Instagram Reel', 'YouTube Shorts', 'YouTube video', 'Facebook group', 'Friend',
  'AbroadMates mentor', 'Other',
];

// Names must match the spelling used by the external university API.
const COUNTRIES: Record<string, string[]> = {
  Europe: [
    'Austria', 'Belgium', 'Czech Republic', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Hungary',
    'Ireland', 'Italy', 'Lithuania', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Russia', 'Spain', 'Sweden',
    'United Kingdom',
  ],
  'North America': ['Canada', 'United States'],
  Asia: ['China', 'Japan', 'South Korea'],
  Oceania: ['Australia', 'New Zealand'],
};

// --------------------------------------------------- mentor-side options ----
const SCHOLARSHIPS: [name: string, region: string][] = [
  ['Erasmus Mundus Joint Masters', 'Europe'], ['Chevening Scholarship', 'UK'], ['Fulbright Scholarship', 'USA'],
  ['Commonwealth Scholarships', 'Commonwealth'], ['DAAD Scholarships', 'Germany'],
  ['Stipendium Hungaricum', 'Hungary'], ['MEXT Scholarship', 'Japan'], ['Global Korea Scholarship', 'South Korea'],
  ['Australia Awards', 'Australia'], ['Swedish Institute Scholarship', 'Sweden'],
];

const SERVICES: [name: string, durationMin: number][] = [['20 min call', 20], ['40 min call', 40]];

const SESSION_CATEGORIES = [
  'Workshop', 'Info session', 'Q&A', 'Application prep', 'Career', 'Scholarships', 'Visa & immigration', 'Other',
];

// Fictional demo mentors (prices in USD for the 20 and 40 minute services).
const MENTORS = [
  { email: 'mentor1@example.com', first: 'Nadia', last: 'Rahman', country: 'Germany', university: 'Technical University of Munich', program: 'masters', scholarship: 'daad-scholarships', rating: 4.9, prices: [12, 20] },
  { email: 'mentor2@example.com', first: 'Arif', last: 'Hossain', country: 'Hungary', university: 'University of Pécs', program: 'masters', scholarship: 'stipendium-hungaricum', rating: 4.7, prices: [10, 18] },
  { email: 'mentor3@example.com', first: 'Maya', last: 'Chen', country: 'Canada', university: 'University of Toronto', program: 'phd', scholarship: null, rating: 4.8, prices: [15, 25] },
  { email: 'mentor4@example.com', first: 'Lukas', last: 'Meyer', country: 'Germany', university: 'Heidelberg University', program: 'phd', scholarship: 'erasmus-mundus-joint-masters', rating: 4.5, prices: [9, 16] },
];
const MENTOR_WITHOUT_PROFILE = { email: 'mentor5@example.com', first: 'Sara', last: 'Ali' }; // to try "create profile"

// ------------------------------------------------------------- seeding ----
const seedReferenceData = async () => {
  await prisma.program.createMany({ skipDuplicates: true, data: named(PROGRAMS) });
  await prisma.studyField.createMany({ skipDuplicates: true, data: named(FIELDS) });
  await prisma.fundingNeed.createMany({ skipDuplicates: true, data: named(FUNDING_NEEDS) });
  await prisma.helpTopic.createMany({ skipDuplicates: true, data: named(HELP_TOPICS) });
  await prisma.acquisitionSource.createMany({ skipDuplicates: true, data: named(SOURCES) });
  await prisma.budgetRange.createMany({
    skipDuplicates: true,
    data: BUDGET_RANGES.map((range, sortOrder) => ({ ...range, sortOrder })),
  });
  await prisma.region.createMany({
    skipDuplicates: true,
    data: [
      ...named(REGIONS).map((region) => ({ ...region, isFlexible: false })),
      { name: FLEXIBLE_REGION, slug: slugify(FLEXIBLE_REGION), isFlexible: true, sortOrder: REGIONS.length },
    ],
  });

  const regions = await prisma.region.findMany();
  for (const [regionName, countries] of Object.entries(COUNTRIES)) {
    const regionId = regions.find((region) => region.name === regionName)!.id;
    await prisma.country.createMany({
      skipDuplicates: true,
      data: countries.map((name) => ({
        name,
        slug: slugify(name),
        regionId,
        title: `Study in ${name}`,
        description: `Connect with mentors who studied in ${name} and get honest, first-hand guidance for your application journey.`,
      })),
    });
  }

  await prisma.scholarship.createMany({
    skipDuplicates: true,
    data: SCHOLARSHIPS.map(([name, region]) => ({
      name,
      region,
      slug: slugify(name),
      title: `${name} Mentors`,
      description: `Connect with mentors who received or applied for the ${name} and get honest, first-hand guidance.`,
    })),
  });
  await prisma.service.createMany({
    skipDuplicates: true,
    data: SERVICES.map(([name, durationMin]) => ({ name, slug: slugify(name), durationMin })),
  });
  await prisma.sessionCategory.createMany({
    skipDuplicates: true,
    data: SESSION_CATEGORIES.map((name) => ({ name, slug: slugify(name) })),
  });
};

const upsertUser = (
  email: string, firstName: string, lastName: string, role: 'STUDENT' | 'MENTOR', passwordHash: string, timezone: string,
) =>
  prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email, firstName, lastName, role, passwordHash, timezone,
      emailVerifiedAt: new Date(),
      referralCode: `${firstName.slice(0, 4).toUpperCase()}-${slugify(email.split('@')[0]).toUpperCase().slice(-4).padEnd(4, 'X')}`,
    },
  });

const seedMentors = async (passwordHash: string) => {
  const services = await prisma.service.findMany({ orderBy: { durationMin: 'asc' } });
  for (const m of MENTORS) {
    const user = await upsertUser(m.email, m.first, m.last, 'MENTOR', passwordHash, 'Europe/Berlin');
    const country = await prisma.country.findUniqueOrThrow({ where: { name: m.country } });
    await prisma.mentorProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        headline: `${m.program === 'phd' ? 'PhD' : "Master's"} mentor at ${m.university}`,
        bio: `I studied in ${m.country} and I can help you with university selection, applications, scholarships and visas.`,
        rating: m.rating,
        user: { connect: { id: user.id } },
        country: { connect: { id: country.id } },
        university: {
          connectOrCreate: {
            where: { name_countryId: { name: m.university, countryId: country.id } },
            create: { name: m.university, countryId: country.id },
          },
        },
        program: { connect: { slug: m.program } },
        scholarship: m.scholarship ? { connect: { slug: m.scholarship } } : undefined,
        plans: { create: services.map((service, index) => ({ serviceId: service.id, price: m.prices[index] })) },
      },
    });
  }
  await upsertUser(MENTOR_WITHOUT_PROFILE.email, MENTOR_WITHOUT_PROFILE.first, MENTOR_WITHOUT_PROFILE.last, 'MENTOR', passwordHash, 'Asia/Dhaka');
};

const seedStudent = async (passwordHash: string) => {
  const student = await upsertUser('student@example.com', 'Demo', 'Student', 'STUDENT', passwordHash, 'Asia/Dhaka');
  if (await prisma.studentProfile.findUnique({ where: { userId: student.id } })) return student;

  type Rows = PromiseLike<{ id: number; slug: string }[]>;
  const bySlug = async (rows: Rows, slugs: string[]) =>
    (await rows).filter((row) => slugs.includes(row.slug)).map((row) => row.id);
  const one = async (rows: Rows, slug: string) => (await bySlug(rows, [slug]))[0];

  const [countryIds, fieldIds, regionIds, helpTopicIds] = await Promise.all([
    bySlug(prisma.country.findMany(), ['germany', 'hungary']),
    bySlug(prisma.studyField.findMany(), ['computer-science-it-data', 'engineering-technology']),
    bySlug(prisma.region.findMany(), ['europe']),
    bySlug(prisma.helpTopic.findMany(), ['scholarships', 'visa-application']),
  ]);
  const budget = await prisma.budgetRange.findFirstOrThrow({ where: { minUsd: 0 } });

  await prisma.studentProfile.create({
    data: {
      user: { connect: { id: student.id } },
      program: { connect: { id: await one(prisma.program.findMany(), 'masters') } },
      budgetRange: { connect: { id: budget.id } },
      fundingNeed: { connect: { id: await one(prisma.fundingNeed.findMany(), 'need-full-scholarship') } },
      source: { connect: { id: await one(prisma.acquisitionSource.findMany(), 'friend') } },
      workWhileStudying: true,
      stayAfterStudy: 'YES',
      ieltsTaken: true,
      ieltsScore: 7.5,
      applyMode: 'ASSISTED',
      fields: { create: fieldIds.map((fieldId) => ({ fieldId })) },
      regions: { create: regionIds.map((regionId) => ({ regionId })) },
      countries: { create: countryIds.map((countryId) => ({ countryId })) },
      helpTopics: { create: helpTopicIds.map((helpTopicId) => ({ helpTopicId })) },
    },
  });
  return student;
};

// Past confirmed bookings feed the "sessions" counter used by "Most sessions" sorting;
// one future PENDING booking gives the dashboard something to show.
const seedBookings = async (studentId: number) => {
  if ((await prisma.booking.count()) > 0) return;
  const plans = await prisma.mentorPlan.findMany({
    where: { service: { durationMin: 20 } },
    orderBy: { mentorId: 'asc' },
  });
  await prisma.booking.createMany({
    data: [
      ...plans.flatMap((plan, planIndex) =>
        Array.from({ length: planIndex + 2 }, (_, n) => ({
          studentId, planId: plan.id, mentorId: plan.mentorId,
          scheduledAt: daysFromNow(-(n + 1) * 3 - planIndex), priceAtBooking: plan.price, status: 'CONFIRMED' as const,
        }))),
      ...(plans[0]
        ? [{ studentId, planId: plans[0].id, mentorId: plans[0].mentorId, scheduledAt: daysFromNow(1), priceAtBooking: plans[0].price, status: 'PENDING' as const }]
        : []),
    ],
  });
};

const seedSessions = async (hostId: number, studentId: number) => {
  if ((await prisma.groupSession.count()) > 0) return;
  const categories = await prisma.sessionCategory.findMany();
  const categoryId = (slug: string) => categories.find((category) => category.slug === slug)!.id;
  const sessions: [title: string, category: string, offsetDays: number][] = [
    ['Canada University Application and Scholarship Overview + Live Q&A', 'workshop', 3],
    ['Erasmus Mundus Application Roadmap: Programmes and Documents', 'application-prep', 6],
    ['Stipendium Hungaricum Application Overview + Live Q&A', 'scholarships', 9],
    ['Visa Interview Preparation for European Universities', 'visa-immigration', 14],
    ['From Bangladesh to a Fully Funded US PhD: Live Roadmap', 'qa', 21],
    ['Japan University Application and Scholarship Roadmap', 'workshop', -5],
    ['GKS Application Overview: Embassy vs University Track', 'info-session', -12],
    ['Writing a Standout Statement of Purpose', 'application-prep', -30],
  ];
  await prisma.groupSession.createMany({
    data: sessions.map(([title, category, offset]) => ({
      title,
      categoryId: categoryId(category),
      description: `${title}. Join live mentors, bring your questions and leave with practical next steps.`,
      startsAt: daysFromNow(offset),
      endsAt: new Date(daysFromNow(offset).getTime() + 90 * 60_000),
      createdById: hostId,
    })),
  });
  const first = await prisma.groupSession.findFirst({ where: { startsAt: { gt: new Date() } }, orderBy: { startsAt: 'asc' } });
  if (first) await prisma.sessionRegistration.create({ data: { sessionId: first.id, studentId } });
};

const main = async () => {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  await seedReferenceData();
  await seedMentors(passwordHash);
  const student = await seedStudent(passwordHash);
  const host = await prisma.user.findUniqueOrThrow({ where: { email: MENTORS[0].email } });
  await seedBookings(student.id);
  await seedSessions(host.id, student.id);
  console.log(
    `Seed complete. Demo logins (password "${DEMO_PASSWORD}"): student@example.com, mentor1@example.com ... mentor4@example.com ` +
      '(mentor5@example.com has no profile yet).',
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
