import { z } from 'zod';
import { optional } from '../../utils/commonSchemas.js';
import { onboardingSchema } from '../students/students.schema.js';

const email = z.string().trim().toLowerCase().email().max(254);
const name = z.string().trim().min(1).max(40);
const captchaToken = z.string().max(4096).optional();
const token = z.string().regex(/^[a-f0-9]{64}$/, 'Invalid token');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters') // bcrypt ignores bytes beyond 72
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const referralCode = optional(z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,20}$/));

/** "Create your student account": onboarding answers + account details. */
export const registerStudentSchema = {
  body: z
    .object({
      firstName: name,
      lastName: name,
      email,
      password,
      confirmPassword: z.string(),
      acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms and Privacy Policy' }) }),
      referralCode,
      captchaToken,
      onboarding: onboardingSchema,
    })
    .refine((body) => body.password === body.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
};

/** "Become a mentor": full name + account details. Returns a login token straight away so the wizard can start. */
export const registerMentorSchema = {
  body: z
    .object({
      fullName: name,
      email,
      password,
      confirmPassword: z.string(),
      acceptTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the Terms and Privacy Policy' }) }),
      captchaToken,
    })
    .refine((body) => body.password === body.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
};

export const loginSchema = {
  body: z.object({ email, password: z.string().min(1).max(72), captchaToken }),
};

export const verifyEmailSchema = { body: z.object({ token }) };
export const emailOnlySchema = { body: z.object({ email, captchaToken }) };
export const resetPasswordSchema = { body: z.object({ token, password }) };

export const googleSchema = {
  body: z.object({
    idToken: z.string().min(10).max(4096),
    referralCode,
    onboarding: onboardingSchema.optional(), // required only when the Google account is new
  }),
};

export type RegisterStudentInput = z.infer<typeof registerStudentSchema.body>;
export type RegisterMentorInput = z.infer<typeof registerMentorSchema.body>;
export type GoogleInput = z.infer<typeof googleSchema.body>;
