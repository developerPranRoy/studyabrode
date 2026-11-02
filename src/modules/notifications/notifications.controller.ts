import { catchAsync } from '../../utils/catchAsync.js';
import { sendNoContent, sendSuccess } from '../../utils/response.js';
import * as service from './notifications.service.js';

export const list = catchAsync(async (req, res) => {
  const { unreadOnly, limit } = req.query as unknown as { unreadOnly: boolean; limit: number };
  const { items, unreadCount } = await service.list(req.user!.id, unreadOnly, limit);
  sendSuccess(res, items, { meta: { unreadCount } });
});

export const markRead = catchAsync(async (req, res) => {
  await service.markRead(Number(req.params.id), req.user!.id);
  sendNoContent(res);
});

export const markAllRead = catchAsync(async (req, res) => {
  await service.markAllRead(req.user!.id);
  sendNoContent(res);
});
