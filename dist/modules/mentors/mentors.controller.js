import path from 'node:path';
import { UPLOAD_ROOT } from '../../middlewares/upload.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { paramId } from '../../utils/commonSchemas.js';
import { sendNoContent, sendSuccess } from '../../utils/response.js';
import { getServices } from '../lookups/lookups.service.js';
import { buildExcel, buildPdf } from './mentors.export.js';
import * as service from './mentors.service.js';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const list = catchAsync(async (req, res) => {
    const { items, meta } = await service.list(req.query, req.user && { id: req.user.id });
    sendSuccess(res, items, { meta });
});
export const getOne = catchAsync(async (req, res) => sendSuccess(res, await service.getById(paramId(req), req.user?.id)));
export const getMine = catchAsync(async (req, res) => sendSuccess(res, await service.getMine(req.user.id)));
export const create = catchAsync(async (req, res) => sendSuccess(res, await service.create(req.user.id, req.body), { status: 201 }));
export const update = catchAsync(async (req, res) => sendSuccess(res, await service.update(paramId(req), req.user.id, req.body)));
export const remove = catchAsync(async (req, res) => {
    await service.remove(paramId(req), req.user.id);
    sendNoContent(res);
});
export const uploadPhoto = catchAsync(async (req, res) => sendSuccess(res, await service.setPhoto(paramId(req), req.user.id, req.uploadedPath)));
export const uploadCv = catchAsync(async (req, res) => sendSuccess(res, await service.setCv(paramId(req), req.user.id, req.uploadedPath)));
export const downloadCv = catchAsync(async (req, res, next) => {
    const { cvPath, fileName } = await service.getCv(paramId(req));
    res.download(path.join(UPLOAD_ROOT, cvPath), fileName, (error) => error && next(error));
});
const sendAttachment = (res, buffer, contentType, fileName) => res.set({ 'Content-Type': contentType, 'Content-Disposition': `attachment; filename="${fileName}"` }).send(buffer);
const loadExportData = async (filters) => Promise.all([service.listForExport(filters), getServices()]);
export const exportExcel = catchAsync(async (req, res) => {
    const [mentors, services] = await loadExportData(req.query);
    sendAttachment(res, await buildExcel(mentors, services), XLSX_MIME, 'mentors.xlsx');
});
export const exportPdf = catchAsync(async (req, res) => {
    const [mentors, services] = await loadExportData(req.query);
    sendAttachment(res, await buildPdf(mentors, services), 'application/pdf', 'mentors.pdf');
});
//# sourceMappingURL=mentors.controller.js.map