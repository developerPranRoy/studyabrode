import { catchAsync } from '../../utils/catchAsync.js';
import { paramId } from '../../utils/commonSchemas.js';
import { sendNoContent, sendSuccess } from '../../utils/response.js';
import type { ListSessionsQuery } from './sessions.schema.js';
import * as service from './sessions.service.js';

export const list = catchAsync(async (req, res) =>
  sendSuccess(res, await service.list(req.query as unknown as ListSessionsQuery, req.user?.id)));

export const listMine = catchAsync(async (req, res) => {
  const { tab } = req.query as unknown as ListSessionsQuery;
  sendSuccess(res, await service.listRegistered(req.user!.id, tab));
});

export const getOne = catchAsync(async (req, res) =>
  sendSuccess(res, await service.getById(paramId(req), req.user?.id)));

export const create = catchAsync(async (req, res) =>
  sendSuccess(res, await service.create(req.user!.id, req.body), { status: 201 }));

export const update = catchAsync(async (req, res) =>
  sendSuccess(res, await service.update(paramId(req), req.user!.id, req.body)));

export const remove = catchAsync(async (req, res) => {
  await service.remove(paramId(req), req.user!.id);
  sendNoContent(res);
});

export const register = catchAsync(async (req, res) =>
  sendSuccess(res, await service.register(paramId(req), req.user!.id), { status: 201 }));

export const unregister = catchAsync(async (req, res) => {
  await service.unregister(paramId(req), req.user!.id);
  sendNoContent(res);
});
