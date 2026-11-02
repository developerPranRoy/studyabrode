import type { NotificationType, Prisma } from '@prisma/client';

interface NewNotification {
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
}

/** Works with the shared client and inside `$transaction` callbacks. */
export const notify = (db: Prisma.TransactionClient, data: NewNotification) =>
  db.notification.create({ data });
