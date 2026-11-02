import crypto from 'node:crypto';
import type { TokenType, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { callToActionMail, sendMail } from '../../lib/mailer.js';
import { notify } from '../../lib/notifications.js';
import { AppError } from '../../utils/AppError.js';
import { generateToken, hashToken } from '../../utils/tokens.js';
import { toProfileData } from '../students/students.service.js';
import type { GoogleInput, RegisterMentorInput, RegisterStudentInput } from './auth.schema.js';

const BCRYPT_ROUNDS = 12;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
// Compared against when the email is unknown, so response time does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-attack-guard', BCRYPT_ROUNDS);
const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

// ------------------------------------------------------------- helpers ----
const toPublicUser = ({ id, firstName, lastName, email, role, timezone, referralCode }: User) => ({
  id, firstName, lastName, email, role, timezone, referralCode,
});

const issueJwt = ({ id, role }: User) =>
  jwt.sign({ role }, env.JWT_SECRET, { subject: String(id), expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'], algorithm: 'HS256' });

const withToken = (user: User) => ({ user: toPublicUser(user), token: issueJwt(user) });

// Referral codes look like "PRAN-PAAZ": first letters of the name + 4 random characters.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomSuffix = () =>
  Array.from(crypto.randomBytes(4), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');

const newReferralCode = async (firstName: string) => {
  const prefix = firstName.normalize('NFKD').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'USER';
  for (let attempt = 0; attempt < 5; attempt++) {
    const referralCode = `${prefix}-${randomSuffix()}`;
    if (!(await prisma.user.findUnique({ where: { referralCode }, select: { id: true } }))) return referralCode;
  }
  throw new AppError('Could not generate a referral code, please retry', 503);
};

// An unknown referral code is ignored: a typo must not block sign-up.
const findReferrerId = async (referralCode?: string) =>
  referralCode ? (await prisma.user.findUnique({ where: { referralCode }, select: { id: true } }))?.id : undefined;

// ------------------------------------------------- one-time email tokens ----
const issueAuthToken = async (userId: number, type: TokenType, ttlMs: number) => {
  const token = generateToken();
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } }), // older links stop working
    prisma.authToken.create({ data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) } }),
  ]);
  return token;
};

/** Atomically marks the token used (so a link works once) and returns its owner. */
const consumeAuthToken = async (token: string, type: TokenType) => {
  const tokenHash = hashToken(token);
  const { count } = await prisma.authToken.updateMany({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (!count) throw AppError.badRequest('This link is invalid or has expired');
  return prisma.authToken.findUniqueOrThrow({ where: { tokenHash }, select: { userId: true } });
};

// A mail outage must not fail the request: the user can always ask for a new link.
const deliver = (mail: Parameters<typeof sendMail>[0]) =>
  sendMail(mail).catch((error) => console.error('Failed to send email:', error));

const sendVerificationEmail = async ({ id, email }: Pick<User, 'id' | 'email'>) => {
  const token = await issueAuthToken(id, 'VERIFY_EMAIL', VERIFY_TTL_MS);
  await deliver(
    callToActionMail(email, 'Verify your AbroadMates account', 'Welcome to AbroadMates. Verify your email to activate your account.',
      'Verify Email', `${env.APP_URL}/verify-email?token=${token}`),
  );
};

// -------------------------------------------------------- registration ----
export const registerStudent = async (input: RegisterStudentInput) => {
  const { firstName, lastName, email, password, referralCode, onboarding } = input;
  const [passwordHash, referredById, ownCode] = await Promise.all([
    bcrypt.hash(password, BCRYPT_ROUNDS),
    findReferrerId(referralCode),
    newReferralCode(firstName),
  ]);

  // Duplicate email -> Prisma P2002 -> 409 via the global error handler.
  const user = await prisma.user.create({
    data: {
      firstName, lastName, email, passwordHash, role: 'STUDENT', timezone: onboarding.timezone,
      referralCode: ownCode, referredById,
      studentProfile: { create: toProfileData(onboarding) },
    },
  });
  await sendVerificationEmail(user);
  return { email: user.email, verificationRequired: true };
};

/**
 * Mentor sign-up: creates a MENTOR account and sends a verification email, but returns a
 * login token immediately so the wizard can begin before the email is verified (publishing
 * at step 11 still requires a verified email). The draft profile is built through the
 * wizard /mentors/me/... endpoints.
 */
export const registerMentor = async (input: RegisterMentorInput) => {
  const { fullName, email, password } = input;
  const [passwordHash, ownCode] = await Promise.all([
    bcrypt.hash(password, BCRYPT_ROUNDS),
    newReferralCode(fullName),
  ]);

  // Store the single "full name" the way the schema expects it (first + last).
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] || fullName;
  const lastName = parts.slice(1).join(' ') || '-';

  // Duplicate email -> Prisma P2002 -> 409 via the global error handler.
  const user = await prisma.user.create({
    data: { firstName, lastName, email, passwordHash, role: 'MENTOR', referralCode: ownCode },
  });
  await sendVerificationEmail(user);
  return { ...withToken(user), verificationRequired: true };
};

export const verifyEmail = async (token: string) => {
  const { userId } = await consumeAuthToken(token, 'VERIFY_EMAIL');
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    await notify(tx, {
      userId, type: 'ACCOUNT', title: 'Welcome to AbroadMates',
      body: 'Your email is verified. Browse mentors and book your first call.',
    });
  });
  return { verified: true };
};

/** Always succeeds from the caller's view, so it cannot be used to discover registered emails. */
export const resendVerification = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.emailVerifiedAt) await sendVerificationEmail(user);
};

// --------------------------------------------------------------- login ----
export const login = async ({ email, password }: { email: string; password: string }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordMatches) throw AppError.unauthorized('Invalid email or password');
  if (!user.emailVerifiedAt) {
    throw AppError.forbidden('Please verify your email before logging in', 'EMAIL_NOT_VERIFIED');
  }
  return withToken(user);
};

export const getMe = async (id: number) => toPublicUser(await prisma.user.findUniqueOrThrow({ where: { id } }));

// ------------------------------------------------------ password reset ----
export const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  const token = await issueAuthToken(user.id, 'RESET_PASSWORD', RESET_TTL_MS);
  await deliver(
    callToActionMail(email, 'Reset your AbroadMates password', 'We received a request to reset your password. This link works for one hour.',
      'Reset Password', `${env.APP_URL}/reset-password?token=${token}`),
  );
};

export const resetPassword = async ({ token, password }: { token: string; password: string }) => {
  const { userId } = await consumeAuthToken(token, 'RESET_PASSWORD');
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  // Following the emailed link also proves ownership of the address.
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { emailVerifiedAt: true } });
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
  });
};

// -------------------------------------------------------------- google ----
export const loginWithGoogle = async ({ idToken, referralCode, onboarding }: GoogleInput) => {
  if (!googleClient) throw new AppError('Google sign-in is not configured', 501);

  const ticket = await googleClient
    .verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID })
    .catch(() => {
      throw AppError.unauthorized('Invalid Google token');
    });
  const profile = ticket.getPayload();
  if (!profile?.email || !profile.email_verified) throw AppError.unauthorized('Google account email is not verified');

  const email = profile.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { googleId: existing.googleId ?? profile.sub, emailVerifiedAt: existing.emailVerifiedAt ?? new Date() },
    });
    return withToken(user);
  }

  if (!onboarding) throw AppError.badRequest('Complete the onboarding questions to create your account');
  const firstName = profile.given_name ?? profile.name ?? 'Student';
  const user = await prisma.user.create({
    data: {
      firstName, lastName: profile.family_name ?? '-', email, googleId: profile.sub, role: 'STUDENT',
      timezone: onboarding.timezone, emailVerifiedAt: new Date(),
      referralCode: await newReferralCode(firstName), referredById: await findReferrerId(referralCode),
      studentProfile: { create: toProfileData(onboarding) },
    },
  });
  return withToken(user);
};
