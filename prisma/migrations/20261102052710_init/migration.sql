-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'MENTOR');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "StayPlan" AS ENUM ('YES', 'NO', 'NOT_ESSENTIAL');

-- CreateEnum
CREATE TYPE "ApplyMode" AS ENUM ('SELF', 'ASSISTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING', 'SESSION', 'ACCOUNT');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "emailVerifiedAt" TIMESTAMP(3),
    "referralCode" TEXT NOT NULL,
    "referredById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "TokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isFlexible" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_fields" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "study_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_ranges" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "minUsd" INTEGER NOT NULL,
    "maxUsd" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "budget_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funding_needs" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "funding_needs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_topics" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "help_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "acquisition_sources" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "acquisition_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "programId" INTEGER NOT NULL,
    "budgetRangeId" INTEGER NOT NULL,
    "fundingNeedId" INTEGER NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "workWhileStudying" BOOLEAN NOT NULL,
    "stayAfterStudy" "StayPlan" NOT NULL,
    "ieltsTaken" BOOLEAN NOT NULL,
    "ieltsScore" DECIMAL(2,1),
    "applyMode" "ApplyMode" NOT NULL,
    "countriesOther" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_fields" (
    "studentId" INTEGER NOT NULL,
    "fieldId" INTEGER NOT NULL,

    CONSTRAINT "student_fields_pkey" PRIMARY KEY ("studentId","fieldId")
);

-- CreateTable
CREATE TABLE "student_regions" (
    "studentId" INTEGER NOT NULL,
    "regionId" INTEGER NOT NULL,

    CONSTRAINT "student_regions_pkey" PRIMARY KEY ("studentId","regionId")
);

-- CreateTable
CREATE TABLE "student_countries" (
    "studentId" INTEGER NOT NULL,
    "countryId" INTEGER NOT NULL,

    CONSTRAINT "student_countries_pkey" PRIMARY KEY ("studentId","countryId")
);

-- CreateTable
CREATE TABLE "student_help_topics" (
    "studentId" INTEGER NOT NULL,
    "helpTopicId" INTEGER NOT NULL,

    CONSTRAINT "student_help_topics_pkey" PRIMARY KEY ("studentId","helpTopicId")
);

-- CreateTable
CREATE TABLE "saved_mentors" (
    "studentId" INTEGER NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_mentors_pkey" PRIMARY KEY ("studentId","mentorId")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "regionId" INTEGER NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "universities" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "countryId" INTEGER NOT NULL,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scholarships" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "scholarships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "session_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_profiles" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "headline" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "rating" DECIMAL(2,1) NOT NULL DEFAULT 0,
    "photoPath" TEXT,
    "cvPath" TEXT,
    "countryId" INTEGER NOT NULL,
    "universityId" INTEGER NOT NULL,
    "programId" INTEGER NOT NULL,
    "scholarshipId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_plans" (
    "id" SERIAL NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "mentor_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "planId" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "priceAtBooking" DECIMAL(10,2) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_sessions" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'Online',
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_registrations" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- CreateIndex
CREATE INDEX "users_referredById_idx" ON "users"("referredById");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_tokenHash_key" ON "auth_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_tokens_userId_type_idx" ON "auth_tokens"("userId", "type");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "regions_name_key" ON "regions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "regions_slug_key" ON "regions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "study_fields_name_key" ON "study_fields"("name");

-- CreateIndex
CREATE UNIQUE INDEX "study_fields_slug_key" ON "study_fields"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "budget_ranges_name_key" ON "budget_ranges"("name");

-- CreateIndex
CREATE UNIQUE INDEX "funding_needs_name_key" ON "funding_needs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "funding_needs_slug_key" ON "funding_needs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "help_topics_name_key" ON "help_topics"("name");

-- CreateIndex
CREATE UNIQUE INDEX "help_topics_slug_key" ON "help_topics"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "acquisition_sources_name_key" ON "acquisition_sources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "acquisition_sources_slug_key" ON "acquisition_sources"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "programs_name_key" ON "programs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "programs_slug_key" ON "programs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_userId_key" ON "student_profiles"("userId");

-- CreateIndex
CREATE INDEX "saved_mentors_mentorId_idx" ON "saved_mentors"("mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");

-- CreateIndex
CREATE UNIQUE INDEX "countries_slug_key" ON "countries"("slug");

-- CreateIndex
CREATE INDEX "countries_regionId_idx" ON "countries"("regionId");

-- CreateIndex
CREATE INDEX "universities_countryId_idx" ON "universities"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "universities_name_countryId_key" ON "universities"("name", "countryId");

-- CreateIndex
CREATE UNIQUE INDEX "scholarships_name_key" ON "scholarships"("name");

-- CreateIndex
CREATE UNIQUE INDEX "scholarships_slug_key" ON "scholarships"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "services_name_key" ON "services"("name");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "services_durationMin_key" ON "services"("durationMin");

-- CreateIndex
CREATE UNIQUE INDEX "session_categories_name_key" ON "session_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "session_categories_slug_key" ON "session_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_profiles_userId_key" ON "mentor_profiles"("userId");

-- CreateIndex
CREATE INDEX "mentor_profiles_countryId_idx" ON "mentor_profiles"("countryId");

-- CreateIndex
CREATE INDEX "mentor_profiles_universityId_idx" ON "mentor_profiles"("universityId");

-- CreateIndex
CREATE INDEX "mentor_profiles_programId_idx" ON "mentor_profiles"("programId");

-- CreateIndex
CREATE INDEX "mentor_profiles_scholarshipId_idx" ON "mentor_profiles"("scholarshipId");

-- CreateIndex
CREATE INDEX "mentor_plans_serviceId_idx" ON "mentor_plans"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_plans_mentorId_serviceId_key" ON "mentor_plans"("mentorId", "serviceId");

-- CreateIndex
CREATE INDEX "bookings_studentId_idx" ON "bookings"("studentId");

-- CreateIndex
CREATE INDEX "bookings_mentorId_scheduledAt_idx" ON "bookings"("mentorId", "scheduledAt");

-- CreateIndex
CREATE INDEX "group_sessions_startsAt_idx" ON "group_sessions"("startsAt");

-- CreateIndex
CREATE INDEX "group_sessions_categoryId_idx" ON "group_sessions"("categoryId");

-- CreateIndex
CREATE INDEX "session_registrations_studentId_idx" ON "session_registrations"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "session_registrations_sessionId_studentId_key" ON "session_registrations"("sessionId", "studentId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_budgetRangeId_fkey" FOREIGN KEY ("budgetRangeId") REFERENCES "budget_ranges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_fundingNeedId_fkey" FOREIGN KEY ("fundingNeedId") REFERENCES "funding_needs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "acquisition_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fields" ADD CONSTRAINT "student_fields_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_fields" ADD CONSTRAINT "student_fields_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "study_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_regions" ADD CONSTRAINT "student_regions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_regions" ADD CONSTRAINT "student_regions_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_countries" ADD CONSTRAINT "student_countries_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_countries" ADD CONSTRAINT "student_countries_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_help_topics" ADD CONSTRAINT "student_help_topics_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_help_topics" ADD CONSTRAINT "student_help_topics_helpTopicId_fkey" FOREIGN KEY ("helpTopicId") REFERENCES "help_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_mentors" ADD CONSTRAINT "saved_mentors_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_mentors" ADD CONSTRAINT "saved_mentors_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "universities" ADD CONSTRAINT "universities_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_profiles" ADD CONSTRAINT "mentor_profiles_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "scholarships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_plans" ADD CONSTRAINT "mentor_plans_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_plans" ADD CONSTRAINT "mentor_plans_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "mentor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_planId_fkey" FOREIGN KEY ("planId") REFERENCES "mentor_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "session_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_sessions" ADD CONSTRAINT "group_sessions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_registrations" ADD CONSTRAINT "session_registrations_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "group_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_registrations" ADD CONSTRAINT "session_registrations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
