import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import bookingRoutes from './modules/bookings/bookings.routes.js';
import lookupRoutes from './modules/lookups/lookups.routes.js';
import mentorRoutes from './modules/mentors/mentors.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import sessionRoutes from './modules/sessions/sessions.routes.js';
import studentRoutes from './modules/students/students.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/lookups', lookupRoutes);
router.use('/students', studentRoutes);
router.use('/mentors', mentorRoutes);
router.use('/bookings', bookingRoutes);
router.use('/sessions', sessionRoutes);
router.use('/notifications', notificationRoutes);

export default router;
