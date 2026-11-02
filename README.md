# AbroadMates API

REST API for a study-abroad mentorship platform: student onboarding and dashboard, mentor profiles with
call plans, 1:1 bookings, group sessions, notifications, file upload/export.
**Stack:** Node.js 20+, TypeScript, Express 4, PostgreSQL 16, Prisma 6, JWT, Zod.

> Status: student side is complete. The **mentor sign-up flow and mentor dashboard** will be added once their
> screens are available (mentor accounts, profiles, plans and group sessions already work through the API).

## Quick start

```bash
cp .env.example .env            # then set JWT_SECRET (>= 32 random chars)
docker compose up -d            # PostgreSQL (or point DATABASE_URL at your own)
npm install
npm run db:setup                # migrate -> create stored functions -> seed reference + demo data
npm run dev                     # http://localhost:5000  (health: /health)
```

Demo accounts (password `Password123`, all email-verified): `student@example.com`, `mentor1@example.com` ... `mentor4@example.com`;
`mentor5@example.com` has no profile yet (to try "create profile"). In development, verification / reset
emails are **printed in the API console** (set `SMTP_HOST` to really send them).

Test with **Postman**: import `postman/AbroadMates.postman_collection.json` and run the folders in order
(76 requests with assertions; option ids and tokens are stored automatically). Endpoint reference: [docs/API.md](docs/API.md).

| Script | What it does |
| --- | --- |
| `npm run dev` | Start with reload (tsx) |
| `npm run build` / `npm start` | Compile to `dist/` / run the compiled server |
| `npm run typecheck` | `tsc --noEmit` over src, seed and scripts |
| `npm run db:setup` | First-time setup: `migrate dev` + `db:sql` + `db:seed` |
| `npm run db:sql` | (Re)create the stored functions (idempotent; run after schema changes) |
| `npm run db:seed` | Reference + demo data (idempotent) |
| `npm run db:reset` | Drop everything and rebuild |
| `npm run db:deploy` | `prisma migrate deploy` for production (then run `db:sql`) |

## What the student flow looks like

1. **Onboarding (13 steps, anonymous)** - the client loads every option list from `GET /lookups/onboarding-options`
   (degrees, fields, regions, budget ranges, funding, help topics, sources) and countries from
   `GET /lookups/countries?regionIds=..&withMentors=true`. Nothing is hard-coded in the API: all options are database rows.
2. **Create account** - `POST /auth/register` receives account details + all answers and creates the user and
   student profile in one transaction, then e-mails a verification link (Cloudflare Turnstile captcha, referral code
   `?ref=` supported). Login is refused with `EMAIL_NOT_VERIFIED` until the link is used. Google sign-up: `POST /auth/google`.
3. **Dashboard** - `GET /students/me/overview` (profile, referral stats, what's coming up), `.../schedule`
   (calendar), `GET /bookings/my` (1:1 Sessions), `GET /sessions/my` (Group Sessions), saved mentors, profile info,
   time zone, notifications bell.
4. **Booking** - a booking starts **PENDING** ("Continue payment" / "Withdraw session"), becomes CONFIRMED after payment.

## Architecture

Feature modules, each with the same layers. Dependencies point inwards only
(routes -> controller -> service -> database); cross-cutting concerns live in middleware.

```
src/
  app.ts / server.ts          Express setup, security stack, graceful shutdown
  routes.ts                   mounts modules under /api/v1
  config/                     env validation (fail fast), Prisma client
  middlewares/                authenticate/authorize, validate, sanitize, captcha, upload, rate limits, errorHandler
  lib/                        mailer (SMTP or console), notification helper
  utils/                      AppError, catchAsync, response envelope, ownership, shared zod schemas, tokens
  modules/<feature>/
    *.routes.ts               URL + middleware chain (auth, role, validation)
    *.schema.ts               Zod request contracts (types inferred from them)
    *.controller.ts           HTTP only: read req, call service, send response
    *.service.ts              business rules + data access (no Express types)
  modules: auth, lookups, students, notifications, mentors, bookings, sessions
prisma/
  schema.prisma               tables, relations, indexes
  sql/functions.sql           the read layer (stored functions)
  seed.ts                     the only place reference data is written
```

### Reads vs writes
* **Reads** call PostgreSQL functions (`fn_get_mentors`, `fn_get_group_sessions`, `fn_get_my_bookings`,
  `fn_get_student_profile`, `fn_get_student_schedule`, `fn_get_onboarding_options`, lookups ...) through
  `prisma.$queryRaw` tagged templates, so every value is a bound parameter. One `fn_get_mentors` serves the list,
  filters, search, sorting, country/scholarship pages, detail, "my profile", saved mentors and exports.
* **Writes** (insert/update/delete) use Prisma. Master + detail (profile + plans) and student sign-up
  (user + profile + answers) are each saved atomically.
* Sorting uses `CASE`, not string-built SQL, so there is no dynamic SQL anywhere.

### No static data
Degrees, fields, regions, countries, budget ranges, funding needs, help topics, sources, services (20/40 min),
session categories and scholarships are **tables**. Filters take slugs, writes take ids, and the database's foreign keys
decide what is valid. Time zones come from the runtime's tz database. Only `Role`, `BookingStatus`, `StayPlan`,
`ApplyMode` (small state enums the code branches on) are enums.

## Security

| Threat | Measure |
| --- | --- |
| SQL injection | Only bound parameters (`$queryRaw` tagged templates, Prisma client); never `$queryRawUnsafe` with user data; filters validated; LIKE wildcards escaped |
| XSS | `sanitizeInput` strips all HTML from user text on the way in; Helmet headers; JSON-only API; emails HTML-escape values. **The Next.js client must still render text as text (never `dangerouslySetInnerHTML` on API data)** |
| Auth | bcrypt (cost 12), JWT HS256 with expiry and pinned algorithm, role guards, ownership checks (403), constant-time compare for unknown emails, login refused until email verified |
| Email links | 256-bit random tokens, only the SHA-256 hash is stored, single use (atomic), expiry (verify 24 h / reset 1 h), generic responses that never reveal whether an email exists |
| Bots / brute force | Cloudflare Turnstile on register/login/forgot/resend, rate limits (300 req / 15 min; 20 for auth routes), 20 KB body limit, HPP |
| Mass assignment | Zod strips unknown fields; public sign-up can only create STUDENT accounts |
| File upload | Size limits, MIME allow-list **and** magic-byte check, random server-side filenames, CVs only via authenticated download, only `/uploads/photos` is public |
| Excel formula injection | ExcelJS writes strings as text cells, never formulas |
| Config | Env validated at boot (weak/missing secret = refuse to start; SMTP + captcha required in production); CORS allow-list |
| Info leaks | Stack traces only in development; unexpected errors become a generic 500 |

## Error handling
* `catchAsync(handler)` forwards any rejected promise to one `errorHandler`; controllers have no try/catch.
* `AppError` = expected, client-safe errors (with optional machine `code`, e.g. `EMAIL_NOT_VERIFIED`). The handler also maps Zod
  (400 + field list), Prisma (`P2002`->409, `P2003`->409, `P2025`->404, `P2034`->409), JWT (401), Multer (400/413), malformed JSON (400).
* `process` handlers for `unhandledRejection` / `uncaughtException` log and shut down gracefully.
* One envelope: `{ success, data, meta? }` or `{ success: false, message, code?, errors? }`.

## Design decisions and trade-offs
* **Stored functions, not `CREATE PROCEDURE`:** PostgreSQL procedures cannot return result sets; functions are the idiomatic equivalent. They live in `prisma/sql/functions.sql`, applied by `db:sql`. For a managed production pipeline, copy that file into a `prisma migrate dev --create-only` migration so it is versioned with the schema.
* **No repository layer:** Prisma and the SQL functions already are the data-access abstraction; an extra layer would be redundant code.
* **Type safety:** request types are inferred from the Zod schemas; raw-query row types are declared next to the query. After `validate()` runs, controllers read already-coerced values (`paramId(req)` / typed casts).
* **University list:** `GET /lookups/universities?countryId=` calls the free Hipo Labs API (HTTP-only, no SLA), caches 24 h and returns 502 if it is down. Country names must match the provider's spelling.
* **Booking clashes:** SERIALIZABLE transaction on `(mentor, start time)`; a PENDING booking holds the slot. Overlapping windows (40-min vs 20-min call 10 min later) and unpaid-booking expiry are not handled yet.
* **Payment:** the gateway is not integrated. `POST /bookings/:id/confirm-payment-dev` (not mounted in production) stands in for the success callback.
* **`sessionsCount`** = confirmed bookings whose start time has passed; **`rating`** is a stored column (no review feature yet).
* **Registration closing** compares `startsAt` with the DB clock (UTC); `registrationOpen` lets the UI disable the button.
* **Images/CV storage** is local disk (`UPLOAD_DIR`); swap `middlewares/upload.ts` for S3/R2 when running several instances.
* **PDF export** uses built-in Latin fonts; embed a Unicode font to print non-Latin names.
* Behind a reverse proxy set `app.set('trust proxy', 1)` so rate limiting sees real client IPs.
* Type-checking was not run in the authoring sandbox (no network to install dependencies): run `npm run typecheck` once after `npm install`.

## Not built yet
Mentor sign-up and dashboard, payment gateway, referral discounts ("5% off"), "Mentor Suite", session-prep forms,
mentor recommendations from the onboarding answers, review/rating submission, automated tests.
