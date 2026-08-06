const YEARS_OF_EXPERIENCE = ['0-1', '1-3', '3-5', '5-10', '10+'] as const;
const HOURLY_RATE_BAND = ['20-40', '40-60', '60-80', '80-100', '100+'] as const;
const PROJECT_RATE_BAND = ['500-1000', '1000-2500', '2500-5000', '5000-10000', '10000+'] as const;
const AVAILABLE_DAY = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

// Only file types a profile photo or a single portfolio upload would plausibly be — not a
// generic file-upload allowlist.
export const UPLOAD_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'video/mp4',
] as const;

export const upsertCreativeProfileBodySchema = {
  type: 'object',
  required: ['primaryRole', 'skills'],
  additionalProperties: false,
  properties: {
    primaryRole: { type: 'string', minLength: 1, maxLength: 100 },
    bio: { type: 'string', maxLength: 2000 },
    profilePhotoKey: { type: 'string', minLength: 1, maxLength: 1024 },
    skills: {
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength: 60 },
      minItems: 1,
      maxItems: 30,
      uniqueItems: true,
    },
    yearsOfExperience: { type: 'string', enum: YEARS_OF_EXPERIENCE },
    previousWorkExperience: { type: 'string', maxLength: 4000 },
    portfolioFileKey: { type: 'string', minLength: 1, maxLength: 1024 },
    availableDays: {
      type: 'array',
      items: { type: 'string', enum: AVAILABLE_DAY },
      maxItems: 7,
      uniqueItems: true,
    },
    availableToTravel: { type: 'boolean' },
    hourlyRateBand: { type: 'string', enum: HOURLY_RATE_BAND },
    projectRateBand: { type: 'string', enum: PROJECT_RATE_BAND },
  },
} as const;

export const creativeProfileResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        accountId: { type: 'string' },
        primaryRole: { type: 'string' },
        bio: { type: ['string', 'null'] },
        profilePhotoKey: { type: ['string', 'null'] },
        skills: { type: 'array', items: { type: 'string' } },
        yearsOfExperience: { type: ['string', 'null'] },
        previousWorkExperience: { type: ['string', 'null'] },
        portfolioFileKey: { type: ['string', 'null'] },
        availableDays: { type: 'array', items: { type: 'string' } },
        availableToTravel: { type: ['boolean', 'null'] },
        hourlyRateBand: { type: ['string', 'null'] },
        projectRateBand: { type: ['string', 'null'] },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  },
} as const;

export const createUploadUrlBodySchema = {
  type: 'object',
  required: ['purpose', 'contentType'],
  additionalProperties: false,
  properties: {
    purpose: { type: 'string', enum: ['profile-photo', 'portfolio'] },
    contentType: { type: 'string', enum: UPLOAD_CONTENT_TYPES },
  },
} as const;

export const uploadUrlResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        uploadUrl: { type: 'string' },
      },
    },
  },
} as const;
