import { Router } from 'express';
import { attachMentor } from '../../middlewares/attachMentor.js';
import { authenticate, authorize } from '../../middlewares/authenticate.js';
import { uploadFile } from '../../middlewares/upload.js';
import { validate } from '../../middlewares/validate.js';
import * as c from './mentor-me.controller.js';
import * as s from './mentor-me.schema.js';

/**
 * The logged-in mentor's own area: the 12-step wizard and the dashboard use the same endpoints
 * (each step is a PUT that replaces that part of the profile and answers with the new progress).
 */
const router = Router();
const photoUpload = uploadFile('photo');
const cvUpload = uploadFile('cv');

router.use(authenticate, authorize('MENTOR'), attachMentor);

router.get('/', c.getProfile);
router.delete('/', c.removeProfile);
router.get('/onboarding', c.getOnboarding); // progress per step + profile strength
router.get('/overview', c.getOverview); // dashboard "Overview"
router.get('/bookings', validate(s.bookingsRangeSchema), c.listBookings); // "Sessions | Booked"

// Wizard steps 1-12 (and the dashboard's Profile / Applied Universities / Background tabs)
router.put('/source', validate(s.sourceSchema), c.saveSource); // 1
router.put('/profile', validate(s.profileSchema), c.saveProfile); // 2
router.post('/photo', ...photoUpload, c.uploadPhoto); // 2 (cropped image from the client)
router.post('/cv', ...cvUpload, c.uploadCv);
router.put('/location', validate(s.locationSchema), c.saveLocation); // 3
router.put('/educations/abroad', validate(s.abroadEducationSchema), c.saveAbroad); // 4
router.put('/educations/background', validate(s.backgroundEducationSchema), c.saveBackground); // 4
router.put('/scholarships', validate(s.scholarshipsSchema), c.saveScholarships); // 5
router.put('/expertise', validate(s.expertiseSchema), c.saveExpertise); // 6
router.get('/availability', c.getAvailability); // 7
router.put('/availability', validate(s.weeklyAvailabilitySchema), c.saveWeekly); // 7
router.delete('/availability', c.clearAvailability);
router.get('/availability/calendar', validate(s.calendarSchema), c.getCalendar);
router.post('/availability/slots', validate(s.oneOffSlotSchema), c.addSlot);
router.delete('/availability/slots/:slotId', validate(s.slotIdParams), c.deleteSlot);
router.patch('/timezone', validate(s.timezoneSchemaBody), c.updateTimezoneHandler);
router.put('/pricing', validate(s.pricingSchema), c.savePricing); // 8
router.get('/payout', c.getPayout); // 9 (masked)
router.put('/payout', validate(s.payoutSchema), c.savePayout); // 9
router.put('/social', validate(s.socialSchema), c.saveSocial); // 10
router.get('/preview', c.preview); // 11
router.post('/publish', c.publish); // 11 "Continue" -> live
router.put('/growth', validate(s.growthSchema), c.saveGrowth); // 12
router.put('/experiences', validate(s.experiencesSchema), c.saveExperiences); // dashboard "Experiences" tab

export default router;
