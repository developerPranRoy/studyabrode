import { catchAsync } from '../../utils/catchAsync.js';
import { sendNoContent, sendSuccess } from '../../utils/response.js';
import { updateTimezone } from '../students/students.service.js';
import * as availability from './availability.service.js';
import * as dashboard from './dashboard.service.js';
import type {
  EducationInput, ExperiencesInput, LocationInput, OneOffSlotInput, PayoutInput, PricingInput, ProfileInput,
  ScholarshipsInput, SocialInput, WeeklyAvailabilityInput,
} from './mentor-me.schema.js';
import * as payout from './payout.service.js';
import * as profile from './profile.service.js';

const DAY_MS = 86_400_000;

// Handlers read req.user / req.mentorId, which `authenticate` + `attachMentor` always set on this router.
const ids = (req: { user?: { id: number }; mentorId?: number }) => ({ userId: req.user!.id, mentorId: req.mentorId! });

const saved = (action: (mentorId: number, body: never, userId: number) => Promise<unknown>) =>
  catchAsync(async (req, res) => {
    const { userId, mentorId } = ids(req);
    await action(mentorId, req.body as never, userId);
    sendSuccess(res, await profile.getOnboarding(userId)); // every step answers with the new progress
  });

// ------------------------------------------------------------ wizard ----
export const getOnboarding = catchAsync(async (req, res) => sendSuccess(res, await profile.getOnboarding(req.user!.id)));
export const getProfile = catchAsync(async (req, res) => sendSuccess(res, await profile.getOwnProfile(req.user!.id)));

export const saveSource = saved((mentorId, body: { sourceId: number }) => profile.saveSource(mentorId, body.sourceId));
export const saveProfile = saved((mentorId, body: ProfileInput, userId) => profile.saveProfile(userId, mentorId, body));
export const saveLocation = saved((mentorId, body: LocationInput) => profile.saveLocation(mentorId, body));
export const saveAbroad = saved((mentorId, body: { educations: EducationInput[] }) =>
  profile.saveEducations(mentorId, 'ABROAD', body.educations));
export const saveBackground = saved((mentorId, body: { educations: EducationInput[] }) =>
  profile.saveEducations(mentorId, 'BACKGROUND', body.educations));
export const saveScholarships = saved((mentorId, body: ScholarshipsInput) => profile.saveScholarships(mentorId, body));
export const saveExpertise = saved((mentorId, body: { helpTopicIds: number[] }) => profile.saveExpertise(mentorId, body.helpTopicIds));
export const saveWeekly = saved((mentorId, body: WeeklyAvailabilityInput, userId) => availability.saveWeekly(mentorId, userId, body));
export const savePricing = saved((mentorId, body: PricingInput) => profile.savePricing(mentorId, body));
export const saveSocial = saved((mentorId, body: SocialInput) => profile.saveSocialLinks(mentorId, body));
export const saveGrowth = saved((mentorId, body: { sharedOnSocial: boolean }) => profile.saveGrowth(mentorId, body.sharedOnSocial));
export const saveExperiences = saved((mentorId, body: ExperiencesInput) => profile.saveExperiences(mentorId, body));

export const getPayout = catchAsync(async (req, res) => sendSuccess(res, await payout.getPayout(req.mentorId!)));
export const savePayout = catchAsync(async (req, res) => {
  const { userId, mentorId } = ids(req);
  await payout.savePayout(mentorId, req.body as PayoutInput);
  sendSuccess(res, await profile.getOnboarding(userId));
});

export const preview = getProfile; // "Preview Profile": how students will see the (possibly still draft) profile
export const publish = catchAsync(async (req, res) => {
  const { userId, mentorId } = ids(req);
  sendSuccess(res, await profile.publish(userId, mentorId));
});

// ------------------------------------------------------ availability ----
export const getAvailability = catchAsync(async (req, res) => sendSuccess(res, await availability.getAvailability(req.mentorId!)));

export const getCalendar = catchAsync(async (req, res) => {
  const { from, to } = req.query as unknown as { from: string; to: string };
  sendSuccess(res, await availability.getCalendarDays(req.mentorId!, from, to));
});

export const addSlot = catchAsync(async (req, res) =>
  sendSuccess(res, await availability.addOneOffSlot(req.mentorId!, req.body as OneOffSlotInput), { status: 201 }));

export const deleteSlot = catchAsync(async (req, res) => {
  await availability.deleteOneOffSlot(req.mentorId!, Number(req.params.slotId));
  sendNoContent(res);
});

export const clearAvailability = catchAsync(async (req, res) => {
  await availability.clearAvailability(req.mentorId!);
  sendNoContent(res);
});

export const updateTimezoneHandler = catchAsync(async (req, res) =>
  sendSuccess(res, await updateTimezone(req.user!.id, req.body.timezone)));

// --------------------------------------------------------- dashboard ----
export const getOverview = catchAsync(async (req, res) => {
  const { userId, mentorId } = ids(req);
  sendSuccess(res, await dashboard.getOverview(userId, mentorId));
});

export const listBookings = catchAsync(async (req, res) => {
  const { from = new Date(), to } = req.query as unknown as { from?: Date; to?: Date };
  sendSuccess(res, await dashboard.listBookings(req.mentorId!, from, to ?? new Date(from.getTime() + 62 * DAY_MS)));
});

// ------------------------------------------------------------- files ----
export const uploadPhoto = catchAsync(async (req, res) => {
  await profile.replaceFile(req.mentorId!, 'photoPath', req.uploadedPath!);
  sendSuccess(res, await profile.getOwnProfile(req.user!.id));
});

export const uploadCv = catchAsync(async (req, res) => {
  await profile.replaceFile(req.mentorId!, 'cvPath', req.uploadedPath!);
  sendSuccess(res, await profile.getOwnProfile(req.user!.id));
});

export const removeProfile = catchAsync(async (req, res) => {
  await profile.removeProfile(req.mentorId!);
  sendNoContent(res);
});
