import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../../middlewares/authenticate.js';
import { uploadFile } from '../../middlewares/upload.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/commonSchemas.js';
import * as controller from './mentors.controller.js';
import { createMentorSchema, exportSchema, listSchema, updateMentorSchema } from './mentors.schema.js';
import mentorMeRouter from '../mentor-me/mentor-me.routes.js';

const router = Router();
const mentorOnly = [authenticate, authorize('MENTOR')];
const photoUpload = uploadFile('photo');
const cvUpload = uploadFile('cv');

// Mount the full mentor-me wizard/dashboard router at /me FIRST so its paths
// are matched before the generic /:id param route below.
router.use('/me', mentorMeRouter);

// Static paths first, so "/export/*" are never captured by "/:id".
router.get('/', optionalAuth, validate(listSchema), controller.list);
router.get('/export/excel', authenticate, validate(exportSchema), controller.exportExcel);
router.get('/export/pdf', authenticate, validate(exportSchema), controller.exportPdf);

router.post('/', ...mentorOnly, validate(createMentorSchema), controller.create);
router.get('/:id', optionalAuth, validate(idParams), controller.getOne);
router.put('/:id', ...mentorOnly, validate(updateMentorSchema), controller.update);
router.delete('/:id', ...mentorOnly, validate(idParams), controller.remove);

router.post('/:id/photo', ...mentorOnly, validate(idParams), ...photoUpload, controller.uploadPhoto);
router.post('/:id/cv', ...mentorOnly, validate(idParams), ...cvUpload, controller.uploadCv);
router.get('/:id/cv', authenticate, validate(idParams), controller.downloadCv);

export default router;
