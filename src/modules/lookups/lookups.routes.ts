import { Router } from 'express';
import { validate } from '../../middlewares/validate.js';
import { slugParams } from '../../utils/commonSchemas.js';
import * as controller from './lookups.controller.js';
import { countriesQuerySchema, universitiesQuerySchema } from './lookups.schema.js';

const router = Router();

router.get('/onboarding-options', controller.onboardingOptions);
router.get('/timezones', controller.timezones);
router.get('/mentor-onboarding-options', controller.mentorOnboardingOptions);
router.get('/pricing-markets', controller.pricingMarkets);
router.get('/services', controller.services);
router.get('/countries', validate(countriesQuerySchema), controller.countries);
router.get('/countries/:slug', validate(slugParams), controller.country);
router.get('/programs', controller.programs);
router.get('/scholarships', controller.scholarships);
router.get('/scholarships/:slug', validate(slugParams), controller.scholarship);
router.get('/services', controller.services);
router.get('/session-categories', controller.sessionCategories);
router.get('/universities', validate(universitiesQuerySchema), controller.universities);

export default router;
