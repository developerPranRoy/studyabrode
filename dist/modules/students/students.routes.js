import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/authenticate.js';
import { validate } from '../../middlewares/validate.js';
import * as controller from './students.controller.js';
import { savedMentorParams, scheduleSchema, timezoneBodySchema, updateProfileSchema } from './students.schema.js';
const router = Router();
router.use(authenticate, authorize('STUDENT'));
router.get('/me', controller.getMe); // "Profile Info"
router.put('/me', validate(updateProfileSchema), controller.updateMe);
router.patch('/me/timezone', validate(timezoneBodySchema), controller.updateTimezone);
router.get('/me/overview', controller.getOverview); // dashboard "Overview"
router.get('/me/schedule', validate(scheduleSchema), controller.getSchedule); // calendar + "What's coming up"
router.get('/me/saved-mentors', controller.listSavedMentors);
router.put('/me/saved-mentors/:mentorId', validate(savedMentorParams), controller.saveMentor);
router.delete('/me/saved-mentors/:mentorId', validate(savedMentorParams), controller.unsaveMentor);
export default router;
//# sourceMappingURL=students.routes.js.map