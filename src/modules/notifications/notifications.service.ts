import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';

interface NotificationRow {
  id: number;
  type: 'BOOKING' | 'SESSION' | 'ACCOUNT';
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
  unreadCount: number;
}

export const list = async (userId: number, unreadOnly: boolean, limit: number) => {
  const rows = await prisma.$queryRaw<NotificationRow[]>`
    SELECT * FROM fn_get_notifications(${userId}::int, ${unreadOnly}::boolean, ${limit}::int)`;
  return { items: rows.map(({ unreadCount, ...item }) => item), unreadCount: rows[0]?.unreadCount ?? 0 };
};

export const markRead = async (id: number, userId: number) => {
  const { count } = await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  if (!count) throw AppError.notFound('Unread notification not found');
};

export const markAllRead = async (userId: number) => {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
};
