import { catchAsync } from '../../utils/catchAsync.js';
import { paramId } from '../../utils/commonSchemas.js';
import { sendSuccess } from '../../utils/response.js';
import * as service from './bookings.service.js';

export const create = catchAsync(async (req, res) =>
  sendSuccess(res, await service.create(req.user!.id, req.body), { status: 201 }));

export const listMine = catchAsync(async (req, res) => sendSuccess(res, await service.listMine(req.user!.id)));

export const withdraw = catchAsync(async (req, res) =>
  sendSuccess(res, await service.withdraw(paramId(req), req.user!.id)));

export const confirmPaymentDev = catchAsync(async (req, res) =>
  sendSuccess(res, await service.confirmPaymentDev(paramId(req), req.user!.id)));
