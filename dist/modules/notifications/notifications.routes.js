import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middlewares/authenticate.js';
import { validate } from '../../middlewares/validate.js';
import { idParams } from '../../utils/commonSchemas.js';
import * as controller from './notifications.controller.js';
const router = Router();
const listQuery = {
    query: z.object({
        unreadOnly: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
        limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
};
router.use(authenticate);
router.get('/', validate(listQuery), controller.list); // bell icon: items + meta.unreadCount
router.post('/read-all', controller.markAllRead);
router.patch('/:id/read', validate(idParams), controller.markRead);
export default router;
//# sourceMappingURL=notifications.routes.js.map