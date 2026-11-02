import { Router } from 'express';
import { attachMentor } from '../../middlewares/attachMentor.js';
import { authenticate, authorize } from '../../middlewares/authenticate.js';
import { uploadFile } from '../../middlewares/upload.js';
import { validate } from '../../middlewares/validate.js';
import * as c from './mentor-me.controller.js';
import * as s from './mentor-me.schema.js';
const router = Router();
const photoUpload = uploadFile('photo');
const cvUpload = uploadFile('cv');
// All routes require a logged-in MENTOR.
const mentorAuth = [authenticate, authorize('MENTOR')];
// Routes that also need req.mentorId (profile must exist).
const withProfile = [...mentorAuth, attachMentor];
// ── Routes that work even before a profile is created ──────────────────────
// getOnboarding uses req.user.id only — no profile needed yet.
router.get('/onboarding', ...mentorAuth, c.getOnboarding);
// ── Routes that require the profile to exist ───────────────────────────────
router.get('/', ...withProfile, c.getProfile);
router.delete('/', ...withProfile, c.removeProfile);
router.get('/overview', ...withProfile, c.getOverview);
router.get('/bookings', ...withProfile, validate(s.bookingsRangeSchema), c.listBookings);
router.put('/source', ...withProfile, validate(s.sourceSchema), c.saveSource);
router.put('/profile', ...withProfile, validate(s.profileSchema), c.saveProfile);
router.post('/photo', ...withProfile, ...photoUpload, c.uploadPhoto);
router.post('/cv', ...withProfile, ...cvUpload, c.uploadCv);
router.put('/location', ...withProfile, validate(s.locationSchema), c.saveLocation);
router.put('/educations/abroad', ...withProfile, validate(s.abroadEducationSchema), c.saveAbroad);
router.put('/educations/background', ...withProfile, validate(s.backgroundEducationSchema), c.saveBackground);
router.put('/scholarships', ...withProfile, validate(s.scholarshipsSchema), c.saveScholarships);
router.put('/expertise', ...withProfile, validate(s.expertiseSchema), c.saveExpertise);
router.get('/availability', ...withProfile, c.getAvailability);
router.put('/availability', ...withProfile, validate(s.weeklyAvailabilitySchema), c.saveWeekly);
router.delete('/availability', ...withProfile, c.clearAvailability);
router.get('/availability/calendar', ...withProfile, validate(s.calendarSchema), c.getCalendar);
router.post('/availability/slots', ...withProfile, validate(s.oneOffSlotSchema), c.addSlot);
router.delete('/availability/slots/:slotId', ...withProfile, validate(s.slotIdParams), c.deleteSlot);
router.patch('/timezone', ...withProfile, validate(s.timezoneSchemaBody), c.updateTimezoneHandler);
router.put('/pricing', ...withProfile, validate(s.pricingSchema), c.savePricing);
router.get('/payout', ...withProfile, c.getPayout);
router.put('/payout', ...withProfile, validate(s.payoutSchema), c.savePayout);
router.put('/social', ...withProfile, validate(s.socialSchema), c.saveSocial);
router.get('/preview', ...withProfile, c.preview);
router.post('/publish', ...withProfile, c.publish);
router.put('/growth', ...withProfile, validate(s.growthSchema), c.saveGrowth);
router.put('/experiences', ...withProfile, validate(s.experiencesSchema), c.saveExperiences);
export default router;
//# sourceMappingURL=mentor-me.routes.js.map