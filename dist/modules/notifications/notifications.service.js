import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
export const list = async (userId, unreadOnly, limit) => {
    const rows = await prisma.$queryRaw `
    SELECT * FROM fn_get_notifications(${userId}::int, ${unreadOnly}::boolean, ${limit}::int)`;
    return { items: rows.map(({ unreadCount, ...item }) => item), unreadCount: rows[0]?.unreadCount ?? 0 };
};
export const markRead = async (id, userId) => {
    const { count } = await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
    if (!count)
        throw AppError.notFound('Unread notification not found');
};
export const markAllRead = async (userId) => {
    await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
};
//# sourceMappingURL=notifications.service.js.map