# API reference

Base URL: `http://localhost:5000/api/v1` - JSON in/out. Auth: `Authorization: Bearer <token>`.
Success: `{ "success": true, "data": ..., "meta": { ... } }`
Error: `{ "success": false, "message": "...", "code": "EMAIL_NOT_VERIFIED", "errors": [{ "field": "email", "message": "..." }] }`

## Lookups (public; every list comes from the database)
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/lookups/onboarding-options` | `{ programs, fields, regions (isFlexible), budgetRanges, fundingNeeds, helpTopics, sources }` |
| GET | `/lookups/countries` | `?regionIds=1,2` (a "flexible" region matches all) `&withMentors=true` -> `{ id, name, slug, title, description, regionId, mentorCount }` |
| GET | `/lookups/countries/:slug` | country page title + description |
| GET | `/lookups/programs`, `/lookups/services`, `/lookups/session-categories` | `{ id, name, slug }` (services also `durationMin`) |
| GET | `/lookups/scholarships`, `/lookups/scholarships/:slug` | includes `region`, `title`, `description` |
| GET | `/lookups/timezones` | IANA names from the runtime |
| GET | `/lookups/universities?countryId=` | proxied + cached external list `[{ name, website }]` |

## Auth
| Method | Path | Auth | Body / notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | - | Student sign-up (see body below). Sends the verification email. 201 `{ email, verificationRequired }` |
| POST | `/auth/verify-email` | - | `{ token }` from the email link |
| POST | `/auth/resend-verification` | - | `{ email, captchaToken? }` - always 200 |
| POST | `/auth/login` | - | `{ email, password, captchaToken? }` -> `{ user, token }`; 403 `EMAIL_NOT_VERIFIED` until verified |
| POST | `/auth/google` | - | `{ idToken, referralCode?, onboarding? }` (`onboarding` required for a new account); 501 when `GOOGLE_CLIENT_ID` is unset |
| POST | `/auth/forgot-password` | - | `{ email, captchaToken? }` - always 200 |
| POST | `/auth/reset-password` | - | `{ token, password }` |
| GET | `/auth/me` | any | current user |

Register body (every id is a row id from the lookups above):
```json
{
  "firstName": "Pran", "lastName": "Dev", "email": "pran@example.com",
  "password": "Password123", "confirmPassword": "Password123", "acceptTerms": true,
  "referralCode": "PRAN-PAAZ", "captchaToken": "<turnstile token>",
  "onboarding": {
    "programId": 2, "fieldIds": [4, 7], "regionIds": [1], "countryIds": [8, 13], "countriesOther": false,
    "budgetRangeId": 2, "fundingNeedId": 1, "workWhileStudying": true, "stayAfterStudy": "YES",
    "ielts": { "taken": true, "score": 7.5 }, "applyMode": "ASSISTED", "helpTopicIds": [5, 7],
    "timezone": "Asia/Dhaka", "sourceId": 6
  }
}
```
`stayAfterStudy`: `YES|NO|NOT_ESSENTIAL`. `applyMode`: `SELF|ASSISTED` (ASSISTED needs at least one help topic).
`ielts`: `{ "taken": false }` or `{ "taken": true, "score": 0-9 in 0.5 steps }`.

## Student dashboard (STUDENT)
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/students/me/overview` | `{ profile (incl. referralCode, friendsJoined), upcoming[], counts { all, group, oneOnOne } }` |
| GET | `/students/me` | "Profile Info": account + all onboarding answers |
| PUT | `/students/me` | `{ firstName, lastName, onboarding }` replaces the answers |
| PATCH | `/students/me/timezone` | `{ timezone }` ("Save Time Zone") |
| GET | `/students/me/schedule` | `?from&to&type=ONE_ON_ONE\|GROUP` (default: next 31 days, max 366) - calendar + "What's coming up" |
| GET | `/students/me/saved-mentors` | mentors with `isSaved: true` |
| PUT / DELETE | `/students/me/saved-mentors/:mentorId` | save / remove (204) |
| GET | `/bookings/my` | "1:1 Sessions" |
| GET | `/sessions/my` | "Group Sessions" (`?tab=upcoming\|past\|all`) |

## Notifications (any logged-in user)
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/notifications` | `?unreadOnly=true&limit=20` -> items, `meta.unreadCount` (bell badge) |
| PATCH | `/notifications/:id/read` | 204 |
| POST | `/notifications/read-all` | 204 |

## Mentors
| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/mentors` | optional | `country`, `program`, `scholarship`, `service` (slugs), `search` (name/university), `sort` (`top_rated`\|`most_sessions`\|`price_asc`), `page`, `limit` (<=50). `isSaved` is filled for logged-in users. Country page = `?country=germany` |
| GET | `/mentors/:id` | optional | mentor with `plans[]` |
| GET | `/mentors/me` | MENTOR | own profile |
| POST | `/mentors` | MENTOR | create profile + plans (one per user, else 409) |
| PUT | `/mentors/:id` | MENTOR (owner) | replace profile + plans (plans missing from the body are removed unless booked) |
| DELETE | `/mentors/:id` | MENTOR (owner) | 409 if bookings exist |
| POST | `/mentors/:id/photo` | MENTOR (owner) | multipart field `file`, JPEG/PNG <= 2 MB |
| POST | `/mentors/:id/cv` | MENTOR (owner) | multipart field `file`, PDF <= 5 MB |
| GET | `/mentors/:id/cv` | logged-in | downloads the PDF |
| GET | `/mentors/export/excel`, `/mentors/export/pdf` | logged-in | same filters as the list (no paging); one price column per service |

Mentor body:
```json
{
  "headline": "Master's mentor at TU Berlin", "bio": "At least 20 characters ...",
  "countryId": 12, "universityName": "Technical University of Berlin", "programId": 2, "scholarshipId": 5,
  "plans": [ { "serviceId": 1, "price": 12 }, { "serviceId": 2, "price": 22.5 } ]
}
```
Photos are served at `photoUrl` (e.g. `/uploads/photos/<uuid>.jpg`).

## Bookings (STUDENT)
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/bookings` | `{ planId, scheduledAt (future ISO date) }` -> status `PENDING`; 409 if the slot is taken |
| GET | `/bookings/my` | list with `status` `PENDING\|CONFIRMED\|CANCELLED` |
| PATCH | `/bookings/:id/withdraw` | "Withdraw session": own, future, pending/confirmed bookings |
| POST | `/bookings/:id/confirm-payment-dev` | development stub for the payment callback (not mounted in production) |

## Group sessions
| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| GET | `/sessions` | optional | `tab` = `all\|upcoming\|past`, `category` = slug. Items have `registrationOpen`, `isRegistered`, `attendeesCount`, `category {id,name,slug}` |
| GET | `/sessions/my` | STUDENT | sessions the student registered for |
| GET | `/sessions/:id` | optional | |
| POST / PUT / DELETE | `/sessions`, `/sessions/:id` | MENTOR (host) | `{ title, description, categoryId, startsAt, endsAt, location? }` |
| POST | `/sessions/:id/register` | STUDENT | 409 once `startsAt` has passed or if already registered |
| DELETE | `/sessions/:id/register` | STUDENT | only before the session starts |

## Status codes
400 validation | 401 missing/invalid token | 403 wrong role, not the owner, or `EMAIL_NOT_VERIFIED` | 404 not found | 409 conflict (duplicate, slot taken, registration closed, still referenced) | 413 file/body too large | 429 rate limited | 501 Google not configured | 502 university provider or captcha service down
