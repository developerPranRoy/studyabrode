import { Router } from 'express';
import { env } from '../../config/env.js';
import { authenticate, authorize } from '../../middlewares/authenticate.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/commonSchemas.js';
import * as controller from './bookings.controller.js';
import { createBookingSchema } from './bookings.schema.js';
const router = Router();
router.use(authenticate, authorize('STUDENT'));
router.post('/', validate(createBookingSchema), controller.create);
router.get('/my', controller.listMine); // dashboard "1:1 Sessions" / "My Bookings"
router.patch('/:id/withdraw', validate(idParams), controller.withdraw); // "Withdraw session"
// Payment gateway is not integrated yet; this stub exists only outside production.
if (!env.isProd)
    router.post('/:id/confirm-payment-dev', validate(idParams), controller.confirmPaymentDev);
export default router;
//# sourceMappingURL=bookings.routes.js.map