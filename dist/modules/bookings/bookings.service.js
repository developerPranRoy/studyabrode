import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { notify } from '../../lib/notifications.js';
import { fileUrl } from '../../middlewares/upload.js';
import { AppError } from '../../utils/AppError.js';
// Read through fn_get_my_bookings (optionally a single booking).
const queryBookings = async (studentId, bookingId = null) => {
    const rows = await prisma.$queryRaw `
    SELECT * FROM fn_get_my_bookings(${studentId}::int, ${bookingId}::int)`;
    return rows.map(({ mentorPhotoPath, ...booking }) => ({ ...booking, mentorPhotoUrl: fileUrl(mentorPhotoPath) }));
};
const getOne = async (id, studentId) => (await queryBookings(studentId, id))[0];
export const listMine = (studentId) => queryBookings(studentId);
/**
 * Books a call as PENDING (the student then completes payment). A pending booking already
 * holds the slot. The slot check and the insert run in one SERIALIZABLE transaction, so two
 * students racing for the same mentor/time cannot both succeed (the loser gets 409).
 * Trade-off: only identical start times clash; overlapping 20/40 min windows are not detected.
 */
export const create = async (studentId, { planId, scheduledAt }) => {
    const plan = await prisma.mentorPlan.findUnique({
        where: { id: planId },
        select: { mentorId: true, price: true, mentor: { select: { userId: true } } },
    });
    if (!plan)
        throw AppError.notFound('Plan not found');
    const { id } = await prisma.$transaction(async (tx) => {
        const taken = await tx.booking.count({
            where: { mentorId: plan.mentorId, scheduledAt, status: { in: ['PENDING', 'CONFIRMED'] } },
        });
        if (taken)
            throw AppError.conflict('This time slot is already booked');
        const booking = await tx.booking.create({
            data: { studentId, planId, mentorId: plan.mentorId, scheduledAt, priceAtBooking: plan.price },
            select: { id: true },
        });
        await notify(tx, {
            userId: studentId, type: 'BOOKING', title: 'Booking created',
            body: 'Your session is pending. Complete the payment to confirm it.',
        });
        await notify(tx, {
            userId: plan.mentor.userId, type: 'BOOKING', title: 'New booking request',
            body: `A student requested a session on ${scheduledAt.toISOString()}.`,
        });
        return booking;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return getOne(id, studentId);
};
/** "Withdraw session": a single atomic UPDATE; only the owner's future, still-active booking can be withdrawn. */
export const withdraw = async (id, studentId) => {
    const { count } = await prisma.booking.updateMany({
        where: { id, studentId, status: { in: ['PENDING', 'CONFIRMED'] }, scheduledAt: { gt: new Date() } },
        data: { status: 'CANCELLED' },
    });
    if (!count)
        throw AppError.notFound('No withdrawable booking found');
    const booking = await prisma.booking.findUniqueOrThrow({ where: { id }, select: { mentor: { select: { userId: true } } } });
    await notify(prisma, {
        userId: booking.mentor.userId, type: 'BOOKING', title: 'Session withdrawn',
        body: 'A student withdrew a booked session.',
    });
    return getOne(id, studentId);
};
/**
 * DEVELOPMENT ONLY (route is not mounted in production): stands in for the payment gateway's
 * success callback so the PENDING -> CONFIRMED flow can be tested. Replace with the real webhook.
 */
export const confirmPaymentDev = async (id, studentId) => {
    const { count } = await prisma.booking.updateMany({
        where: { id, studentId, status: 'PENDING', scheduledAt: { gt: new Date() } },
        data: { status: 'CONFIRMED' },
    });
    if (!count)
        throw AppError.notFound('No pending booking found');
    await notify(prisma, {
        userId: studentId, type: 'BOOKING', title: 'Session confirmed', body: 'Your payment was received.',
    });
    return getOne(id, studentId);
};
//# sourceMappingURL=bookings.service.js.map