-- =============================================================================
-- Read layer: every API read goes through one of these SQL functions.
-- Applied by `npm run db:sql` (idempotent). Statements are separated by the
-- "@@split" marker because Prisma executes one statement per call.
--
-- Conventions
--   * Parameters are prefixed p_ and always bound by Prisma (never concatenated),
--     so there is no SQL-injection surface. Sorting uses CASE, not dynamic SQL.
--   * Counts are cast to int and prices to float8 so results are JSON-safe.
--   * "now" is compared in UTC because Prisma stores timestamps as UTC.
--   * A person's display name is firstName || ' ' || lastName.
-- =============================================================================

-- Drop previous versions so return types can change between runs.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE proname LIKE 'fn\_%' AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig;
  END LOOP;
END $$;
-- @@split

-- Countries; optionally narrowed to regions (a "flexible" region matches all) and to
-- countries that currently have mentors (onboarding step 4).
CREATE OR REPLACE FUNCTION fn_get_countries(
  p_slug         text    DEFAULT NULL,
  p_region_ids   int[]   DEFAULT NULL,
  p_with_mentors boolean DEFAULT false
)
RETURNS TABLE (id int, name text, slug text, title text, description text, "regionId" int, "mentorCount" int)
LANGUAGE sql STABLE AS $$
  SELECT c.id, c.name, c.slug, c.title, c.description, c."regionId",
         (SELECT COUNT(*) FROM mentor_profiles m WHERE m."countryId" = c.id)::int
  FROM countries c
  WHERE (p_slug IS NULL OR c.slug = p_slug)
    AND (p_region_ids IS NULL
         OR c."regionId" = ANY (p_region_ids)
         OR EXISTS (SELECT 1 FROM regions r WHERE r.id = ANY (p_region_ids) AND r."isFlexible"))
    AND (NOT p_with_mentors
         OR EXISTS (SELECT 1 FROM mentor_profiles m WHERE m."countryId" = c.id))
  ORDER BY c.name
$$;
-- @@split

CREATE OR REPLACE FUNCTION fn_get_programs()
RETURNS TABLE (id int, name text, slug text)
LANGUAGE sql STABLE AS $$
  SELECT p.id, p.name, p.slug FROM programs p ORDER BY p."sortOrder", p.id
$$;
-- @@split

CREATE OR REPLACE FUNCTION fn_get_scholarships(p_slug text DEFAULT NULL)
RETURNS TABLE (id int, name text, slug text, region text, title text, description text)
LANGUAGE sql STABLE AS $$
  SELECT s.id, s.name, s.slug, s.region, s.title, s.description
  FROM scholarships s
  WHERE p_slug IS NULL OR s.slug = p_slug
  ORDER BY s.name
$$;
-- @@split

CREATE OR REPLACE FUNCTION fn_get_services()
RETURNS TABLE (id int, name text, slug text, "durationMin" int)
LANGUAGE sql STABLE AS $$
  SELECT sv.id, sv.name, sv.slug, sv."durationMin" FROM services sv ORDER BY sv."durationMin"
$$;
-- @@split

CREATE OR REPLACE FUNCTION fn_get_session_categories()
RETURNS TABLE (id int, name text, slug text)
LANGUAGE sql STABLE AS $$
  SELECT c.id, c.name, c.slug FROM session_categories c ORDER BY c.id
$$;
-- @@split

-- Every option list the onboarding questionnaire needs, in one round trip.
-- (Countries depend on the chosen regions, so they come from fn_get_countries.)
CREATE OR REPLACE FUNCTION fn_get_onboarding_options()
RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'programs', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'slug', x.slug)
                                           ORDER BY x."sortOrder", x.id), '[]'::jsonb) FROM programs x),
    'fields', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'slug', x.slug)
                                         ORDER BY x."sortOrder", x.id), '[]'::jsonb) FROM study_fields x),
    'regions', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'slug', x.slug,
                                                             'isFlexible', x."isFlexible")
                                          ORDER BY x."sortOrder", x.id), '[]'::jsonb) FROM regions x),
    'budgetRanges', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name,
                                                                  'minUsd', x."minUsd", 'maxUsd', x."maxUsd")
                                               ORDER BY x."sortOrder", x.id), '[]'::jsonb) FROM budget_ranges x),
    'fundingNeeds', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'slug', x.slug)
                                               ORDER BY x."sortOrder", x.id), '[]'::jsonb) FROM funding_needs x),
    'helpTopics', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'slug', x.slug)
                                             ORDER BY x."sortOrder", x.id), '[]'::jsonb) FROM help_topics x),
    'sources', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'slug', x.slug)
                                          ORDER BY x."sortOrder", x.id), '[]'::jsonb) FROM acquisition_sources x)
  )
$$;
-- @@split

-- Mentor list / detail / "my profile" / saved mentors / export, all through one function.
--   p_sort: 'top_rated' | 'most_sessions' | 'price_asc'
--   p_service: service slug (e.g. '40-min-call')
--   p_viewer_id: the logged-in student, used for "isSaved"; p_saved_only limits to their saved mentors
--   "sessionsCount" = confirmed bookings whose start time has passed
CREATE OR REPLACE FUNCTION fn_get_mentors(
  p_country     text    DEFAULT NULL,
  p_program     text    DEFAULT NULL,
  p_scholarship text    DEFAULT NULL,
  p_service     text    DEFAULT NULL,
  p_search      text    DEFAULT NULL,
  p_sort        text    DEFAULT 'top_rated',
  p_limit       int     DEFAULT 12,
  p_offset      int     DEFAULT 0,
  p_id          int     DEFAULT NULL,
  p_user_id     int     DEFAULT NULL,
  p_viewer_id   int     DEFAULT NULL,
  p_saved_only  boolean DEFAULT false
)
RETURNS TABLE (
  id int, "fullName" text, headline text, bio text, "photoPath" text, "hasCv" boolean,
  rating float8, "sessionsCount" int, "startingPrice" float8, "isSaved" boolean,
  country jsonb, university jsonb, program jsonb, scholarship jsonb, plans jsonb,
  "totalCount" int
)
LANGUAGE sql STABLE AS $$
  SELECT
    m.id,
    (u."firstName" || ' ' || u."lastName"),
    m.headline,
    m.bio,
    m."photoPath",
    (m."cvPath" IS NOT NULL),
    m.rating::float8,
    bk.cnt::int,
    pl."minPrice"::float8,
    EXISTS (SELECT 1 FROM saved_mentors sm WHERE sm."mentorId" = m.id AND sm."studentId" = p_viewer_id),
    jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug),
    jsonb_build_object('id', un.id, 'name', un.name),
    jsonb_build_object('id', pr.id, 'name', pr.name, 'slug', pr.slug),
    CASE WHEN sc.id IS NULL THEN NULL
         ELSE jsonb_build_object('id', sc.id, 'name', sc.name, 'slug', sc.slug) END,
    pl.plans,
    (COUNT(*) OVER ())::int
  FROM mentor_profiles m
  JOIN users u         ON u.id  = m."userId"
  JOIN countries c     ON c.id  = m."countryId"
  JOIN universities un ON un.id = m."universityId"
  JOIN programs pr     ON pr.id = m."programId"
  LEFT JOIN scholarships sc ON sc.id = m."scholarshipId"
  CROSS JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM bookings b
    WHERE b."mentorId" = m.id
      AND b.status = 'CONFIRMED'
      AND b."scheduledAt" <= (NOW() AT TIME ZONE 'UTC')
  ) bk
  CROSS JOIN LATERAL (
    SELECT MIN(mp.price) AS "minPrice",
           COALESCE(
             jsonb_agg(jsonb_build_object('id', mp.id, 'serviceId', sv.id, 'service', sv.name,
                                          'durationMin', sv."durationMin", 'price', mp.price::float8)
                       ORDER BY sv."durationMin"),
             '[]'::jsonb) AS plans
    FROM mentor_plans mp
    JOIN services sv ON sv.id = mp."serviceId"
    WHERE mp."mentorId" = m.id
  ) pl
  WHERE (p_id IS NULL          OR m.id = p_id)
    AND (p_user_id IS NULL     OR m."userId" = p_user_id)
    AND (p_country IS NULL     OR c.slug = p_country)
    AND (p_program IS NULL     OR pr.slug = p_program)
    AND (p_scholarship IS NULL OR sc.slug = p_scholarship)
    AND (p_service IS NULL     OR EXISTS (SELECT 1 FROM mentor_plans x
                                          JOIN services xs ON xs.id = x."serviceId"
                                          WHERE x."mentorId" = m.id AND xs.slug = p_service))
    AND (p_search IS NULL      OR (u."firstName" || ' ' || u."lastName") ILIKE '%' || p_search || '%'
                               OR un.name ILIKE '%' || p_search || '%')
    AND (NOT p_saved_only      OR EXISTS (SELECT 1 FROM saved_mentors sm
                                          WHERE sm."mentorId" = m.id AND sm."studentId" = p_viewer_id))
  ORDER BY
    CASE WHEN p_sort = 'top_rated'     THEN m.rating END DESC NULLS LAST,
    CASE WHEN p_sort = 'most_sessions' THEN bk.cnt END DESC NULLS LAST,
    CASE WHEN p_sort = 'price_asc'     THEN pl."minPrice" END ASC NULLS LAST,
    m.id
  LIMIT p_limit OFFSET p_offset
$$;
-- @@split

-- Group sessions. p_tab: 'all' | 'upcoming' | 'past'; p_category: category slug;
-- p_registered_only: only sessions the student (p_student_id) registered for.
-- "registrationOpen" is derived from the clock, so registration closes by itself.
CREATE OR REPLACE FUNCTION fn_get_group_sessions(
  p_tab             text    DEFAULT 'all',
  p_category        text    DEFAULT NULL,
  p_student_id      int     DEFAULT NULL,
  p_id              int     DEFAULT NULL,
  p_registered_only boolean DEFAULT false
)
RETURNS TABLE (
  id int, title text, description text, category jsonb,
  "startsAt" timestamp, "endsAt" timestamp, location text, "hostName" text,
  "attendeesCount" int, "registrationOpen" boolean, "isRegistered" boolean
)
LANGUAGE sql STABLE AS $$
  WITH clock AS (SELECT (NOW() AT TIME ZONE 'UTC') AS utc_now)
  SELECT
    gs.id,
    gs.title,
    gs.description,
    jsonb_build_object('id', cat.id, 'name', cat.name, 'slug', cat.slug),
    gs."startsAt",
    gs."endsAt",
    gs.location,
    (u."firstName" || ' ' || u."lastName"),
    (SELECT COUNT(*) FROM session_registrations sr WHERE sr."sessionId" = gs.id)::int,
    gs."startsAt" > clock.utc_now,
    EXISTS (SELECT 1 FROM session_registrations sr
            WHERE sr."sessionId" = gs.id AND sr."studentId" = p_student_id)
  FROM group_sessions gs
  JOIN users u ON u.id = gs."createdById"
  JOIN session_categories cat ON cat.id = gs."categoryId"
  CROSS JOIN clock
  WHERE (p_id IS NULL       OR gs.id = p_id)
    AND (p_category IS NULL OR cat.slug = p_category)
    AND (p_tab = 'all'
         OR (p_tab = 'upcoming' AND gs."startsAt" >  clock.utc_now)
         OR (p_tab = 'past'     AND gs."startsAt" <= clock.utc_now))
    AND (NOT p_registered_only
         OR EXISTS (SELECT 1 FROM session_registrations sr
                    WHERE sr."sessionId" = gs.id AND sr."studentId" = p_student_id))
  ORDER BY
    CASE WHEN p_tab = 'past' THEN gs."startsAt" END DESC,
    gs."startsAt" ASC
$$;
-- @@split

-- A student's 1:1 bookings (optionally a single one), newest call first.
CREATE OR REPLACE FUNCTION fn_get_my_bookings(p_student_id int, p_booking_id int DEFAULT NULL)
RETURNS TABLE (
  id int, status text, "scheduledAt" timestamp, service text, "durationMin" int, price float8,
  "createdAt" timestamp, "mentorId" int, "mentorName" text, "mentorPhotoPath" text,
  university text, country text
)
LANGUAGE sql STABLE AS $$
  SELECT
    b.id,
    b.status::text,
    b."scheduledAt",
    sv.name,
    sv."durationMin",
    b."priceAtBooking"::float8,
    b."createdAt",
    m.id,
    (u."firstName" || ' ' || u."lastName"),
    m."photoPath",
    un.name,
    c.name
  FROM bookings b
  JOIN mentor_plans mp   ON mp.id = b."planId"
  JOIN services sv       ON sv.id = mp."serviceId"
  JOIN mentor_profiles m ON m.id  = b."mentorId"
  JOIN users u           ON u.id  = m."userId"
  JOIN universities un   ON un.id = m."universityId"
  JOIN countries c       ON c.id  = m."countryId"
  WHERE b."studentId" = p_student_id
    AND (p_booking_id IS NULL OR b.id = p_booking_id)
  ORDER BY b."scheduledAt" DESC
$$;
-- @@split

-- Student calendar / "What's coming up": 1:1 bookings (not withdrawn) + registered group
-- sessions starting in [p_from, p_to). p_type: 'ONE_ON_ONE' | 'GROUP' | NULL for both.
CREATE OR REPLACE FUNCTION fn_get_student_schedule(
  p_student_id int,
  p_from       timestamp,
  p_to         timestamp,
  p_type       text DEFAULT NULL
)
RETURNS TABLE (
  kind text, id int, title text, "startsAt" timestamp, "endsAt" timestamp, status text,
  "durationMin" int, "counterpartName" text, "counterpartPhotoPath" text, location text
)
LANGUAGE sql STABLE AS $$
  SELECT s.* FROM (
    SELECT 'ONE_ON_ONE'::text AS kind,
           b.id,
           ('Session with ' || mu."firstName" || ' ' || mu."lastName") AS title,
           b."scheduledAt" AS "startsAt",
           b."scheduledAt" + make_interval(mins => sv."durationMin") AS "endsAt",
           b.status::text AS status,
           sv."durationMin" AS "durationMin",
           (mu."firstName" || ' ' || mu."lastName") AS "counterpartName",
           m."photoPath" AS "counterpartPhotoPath",
           NULL::text AS location
    FROM bookings b
    JOIN mentor_plans mp   ON mp.id = b."planId"
    JOIN services sv       ON sv.id = mp."serviceId"
    JOIN mentor_profiles m ON m.id  = b."mentorId"
    JOIN users mu          ON mu.id = m."userId"
    WHERE b."studentId" = p_student_id AND b.status <> 'CANCELLED'
    UNION ALL
    SELECT 'GROUP'::text,
           gs.id,
           gs.title,
           gs."startsAt",
           gs."endsAt",
           'REGISTERED'::text,
           NULL::int,
           (hu."firstName" || ' ' || hu."lastName"),
           NULL::text,
           gs.location
    FROM session_registrations sr
    JOIN group_sessions gs ON gs.id = sr."sessionId"
    JOIN users hu          ON hu.id = gs."createdById"
    WHERE sr."studentId" = p_student_id
  ) s
  WHERE s."startsAt" >= p_from AND s."startsAt" < p_to
    AND (p_type IS NULL OR s.kind = p_type)
  ORDER BY s."startsAt"
$$;
-- @@split

-- Student account + onboarding answers ("Profile Info", dashboard header, referral stats).
CREATE OR REPLACE FUNCTION fn_get_student_profile(p_user_id int)
RETURNS TABLE (
  id int, "firstName" text, "lastName" text, email text, timezone text, "emailVerified" boolean,
  "referralCode" text, "friendsJoined" int, "createdAt" timestamp, onboarding jsonb
)
LANGUAGE sql STABLE AS $$
  SELECT
    u.id, u."firstName", u."lastName", u.email, u.timezone, (u."emailVerifiedAt" IS NOT NULL),
    u."referralCode",
    (SELECT COUNT(*) FROM users r WHERE r."referredById" = u.id)::int,
    u."createdAt",
    CASE WHEN sp.id IS NULL THEN NULL ELSE jsonb_build_object(
      'program', (SELECT jsonb_build_object('id', p.id, 'name', p.name, 'slug', p.slug)
                  FROM programs p WHERE p.id = sp."programId"),
      'fields', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', f.id, 'name', f.name, 'slug', f.slug)
                                           ORDER BY f."sortOrder"), '[]'::jsonb)
                 FROM student_fields sf JOIN study_fields f ON f.id = sf."fieldId"
                 WHERE sf."studentId" = sp.id),
      'regions', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug)
                                            ORDER BY r."sortOrder"), '[]'::jsonb)
                  FROM student_regions sr JOIN regions r ON r.id = sr."regionId"
                  WHERE sr."studentId" = sp.id),
      'countries', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug)
                                              ORDER BY c.name), '[]'::jsonb)
                    FROM student_countries sc JOIN countries c ON c.id = sc."countryId"
                    WHERE sc."studentId" = sp.id),
      'countriesOther', sp."countriesOther",
      'budgetRange', (SELECT jsonb_build_object('id', b.id, 'name', b.name)
                      FROM budget_ranges b WHERE b.id = sp."budgetRangeId"),
      'fundingNeed', (SELECT jsonb_build_object('id', fnd.id, 'name', fnd.name, 'slug', fnd.slug)
                      FROM funding_needs fnd WHERE fnd.id = sp."fundingNeedId"),
      'workWhileStudying', sp."workWhileStudying",
      'stayAfterStudy', sp."stayAfterStudy"::text,
      'ielts', jsonb_build_object('taken', sp."ieltsTaken", 'score', sp."ieltsScore"::float8),
      'applyMode', sp."applyMode"::text,
      'helpTopics', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', h.id, 'name', h.name, 'slug', h.slug)
                                               ORDER BY h."sortOrder"), '[]'::jsonb)
                     FROM student_help_topics sh JOIN help_topics h ON h.id = sh."helpTopicId"
                     WHERE sh."studentId" = sp.id),
      'source', (SELECT jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug)
                 FROM acquisition_sources s WHERE s.id = sp."sourceId")
    ) END
  FROM users u
  LEFT JOIN student_profiles sp ON sp."userId" = u.id
  WHERE u.id = p_user_id
$$;
-- @@split

CREATE OR REPLACE FUNCTION fn_get_notifications(
  p_user_id     int,
  p_unread_only boolean DEFAULT false,
  p_limit       int     DEFAULT 20
)
RETURNS TABLE (
  id int, type text, title text, body text, "readAt" timestamp, "createdAt" timestamp, "unreadCount" int
)
LANGUAGE sql STABLE AS $$
  SELECT n.id, n.type::text, n.title, n.body, n."readAt", n."createdAt",
         (SELECT COUNT(*) FROM notifications x WHERE x."userId" = p_user_id AND x."readAt" IS NULL)::int
  FROM notifications n
  WHERE n."userId" = p_user_id
    AND (NOT p_unread_only OR n."readAt" IS NULL)
  ORDER BY n."createdAt" DESC, n.id DESC
  LIMIT p_limit
$$;
