import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../../middlewares/authenticate.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/commonSchemas.js';
import * as controller from './sessions.controller.js';
import { createSessionSchema, listSessionsSchema, updateSessionSchema } from './sessions.schema.js';
const router = Router();
const mentorOnly = [authenticate, authorize('MENTOR')];
const studentOnly = [authenticate, authorize('STUDENT')];
// Public, but `isRegistered` is filled in when a student token is supplied.
router.get('/', optionalAuth, validate(listSessionsSchema), controller.list);
router.get('/my', ...studentOnly, validate(listSessionsSchema), controller.listMine); // dashboard "Group Sessions"
router.get('/:id', optionalAuth, validate(idParams), controller.getOne);
router.post('/', ...mentorOnly, validate(createSessionSchema), controller.create);
router.put('/:id', ...mentorOnly, validate(updateSessionSchema), controller.update);
router.delete('/:id', ...mentorOnly, validate(idParams), controller.remove);
router.post('/:id/register', ...studentOnly, validate(idParams), controller.register);
router.delete('/:id/register', ...studentOnly, validate(idParams), controller.unregister);
export default router;
//# sourceMappingURL=sessions.routes.js.map