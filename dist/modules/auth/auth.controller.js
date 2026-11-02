import { catchAsync } from '../../utils/catchAsync.js';
import { sendSuccess } from '../../utils/response.js';
import * as service from './auth.service.js';
export const registerStudent = catchAsync(async (req, res) => sendSuccess(res, await service.registerStudent(req.body), { status: 201 }));
export const registerMentor = catchAsync(async (req, res) => sendSuccess(res, await service.registerMentor(req.body), { status: 201 }));
export const verifyEmail = catchAsync(async (req, res) => sendSuccess(res, await service.verifyEmail(req.body.token)));
export const resendVerification = catchAsync(async (req, res) => {
    await service.resendVerification(req.body.email);
    sendSuccess(res, { message: 'If the account exists and is not verified, a new link has been sent.' });
});
export const login = catchAsync(async (req, res) => sendSuccess(res, await service.login(req.body)));
export const loginWithGoogle = catchAsync(async (req, res) => sendSuccess(res, await service.loginWithGoogle(req.body)));
export const forgotPassword = catchAsync(async (req, res) => {
    await service.forgotPassword(req.body.email);
    sendSuccess(res, { message: 'If the account exists, a password reset link has been sent.' });
});
export const resetPassword = catchAsync(async (req, res) => {
    await service.resetPassword(req.body);
    sendSuccess(res, { message: 'Password updated. You can now log in.' });
});
export const getMe = catchAsync(async (req, res) => sendSuccess(res, await service.getMe(req.user.id)));
//# sourceMappingURL=auth.controller.js.map