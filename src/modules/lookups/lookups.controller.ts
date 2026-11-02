import { catchAsync } from '../../utils/catchAsync.js';
import { sendSuccess } from '../../utils/response.js';
import type { CountriesQuery } from './lookups.schema.js';
import * as service from './lookups.service.js';

export const countries = catchAsync(async (req, res) => {
  const { regionIds, withMentors } = req.query as unknown as CountriesQuery;
  sendSuccess(res, await service.getCountries({ regionIds, withMentors }));
});

export const country = catchAsync(async (req, res) =>
  sendSuccess(res, await service.getCountryBySlug(req.params.slug)));

export const programs = catchAsync(async (_req, res) => sendSuccess(res, await service.getPrograms()));
export const scholarships = catchAsync(async (_req, res) => sendSuccess(res, await service.getScholarships()));
export const scholarship = catchAsync(async (req, res) =>
  sendSuccess(res, await service.getScholarshipBySlug(req.params.slug)));
export const services = catchAsync(async (_req, res) => sendSuccess(res, await service.getServices()));
export const sessionCategories = catchAsync(async (_req, res) =>
  sendSuccess(res, await service.getSessionCategories()));
export const onboardingOptions = catchAsync(async (_req, res) =>
  sendSuccess(res, await service.getOnboardingOptions()));
export const timezones = catchAsync(async (_req, res) => sendSuccess(res, service.getTimezones()));

export const universities = catchAsync(async (req, res) => {
  const { countryId } = req.query as unknown as { countryId: number };
  sendSuccess(res, await service.getUniversitiesByCountry(countryId));
});
