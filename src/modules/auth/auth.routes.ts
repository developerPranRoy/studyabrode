import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate.js';
import { verifyCaptcha } from '../../middlewares/captcha.js';
import { authLimiter } from '../../middlewares/rateLimiters.js';
import { validate } from '../../middlewares/validate.js';
import * as controller from './auth.controller.js';
import {
  emailOnlySchema, googleSchema, loginSchema, registerMentorSchema, registerStudentSchema, resetPasswordSchema, verifyEmailSchema,
} from './auth.schema.js';

const router = Router();

// Mentor sign-up is a separate flow (added later); only students self-register here.
router.post('/register', authLimiter, validate(registerStudentSchema), verifyCaptcha, controller.registerStudent);
// Mentor sign-up returns a login token immediately so the wizard can start.
router.post('/register/mentor', authLimiter, validate(registerMentorSchema), controller.registerMentor);
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), controller.verifyEmail);
router.post('/resend-verification', authLimiter, validate(emailOnlySchema), verifyCaptcha, controller.resendVerification);
router.post('/login', authLimiter, validate(loginSchema), verifyCaptcha, controller.login);
router.post('/google', authLimiter, validate(googleSchema), controller.loginWithGoogle);
router.post('/forgot-password', authLimiter, validate(emailOnlySchema), verifyCaptcha, controller.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), controller.resetPassword);
router.get('/me', authenticate, controller.getMe);

export default router;
