import { catchAsync } from '../../utils/catchAsync.js';
import { sendNoContent, sendSuccess } from '../../utils/response.js';
import * as mentorService from '../mentors/mentors.service.js';
import * as service from './students.service.js';
const DAY_MS = 86_400_000;
export const getMe = catchAsync(async (req, res) => sendSuccess(res, await service.getProfile(req.user.id)));
export const updateMe = catchAsync(async (req, res) => sendSuccess(res, await service.updateProfile(req.user.id, req.body)));
export const updateTimezone = catchAsync(async (req, res) => sendSuccess(res, await service.updateTimezone(req.user.id, req.body.timezone)));
export const getOverview = catchAsync(async (req, res) => sendSuccess(res, await service.getOverview(req.user.id)));
export const getSchedule = catchAsync(async (req, res) => {
    const { from = new Date(), to, type } = req.query;
    const range = { from, to: to ?? new Date(from.getTime() + 31 * DAY_MS), type };
    sendSuccess(res, await service.getSchedule(req.user.id, range));
});
export const listSavedMentors = catchAsync(async (req, res) => {
    const { items, meta } = await mentorService.list({ sort: 'top_rated', page: 1, limit: 50 }, { id: req.user.id, savedOnly: true });
    sendSuccess(res, items, { meta });
});
export const saveMentor = catchAsync(async (req, res) => {
    await service.saveMentor(req.user.id, Number(req.params.mentorId));
    sendNoContent(res);
});
export const unsaveMentor = catchAsync(async (req, res) => {
    await service.unsaveMentor(req.user.id, Number(req.params.mentorId));
    sendNoContent(res);
});
//# sourceMappingURL=students.controller.js.map