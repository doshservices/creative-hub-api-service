import { objectIdSchema } from '../../common/schema.js';

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
const PORTFOLIO_MEDIA_TYPE = ['video', 'image', 'audio', 'doc'] as const;

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
    location: { type: 'string', minLength: 1, maxLength: 200 },
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

const creativeProfileProperties = {
  id: { type: 'string' },
  accountId: { type: 'string' },
  primaryRole: { type: 'string' },
  bio: { type: ['string', 'null'] },
  location: { type: ['string', 'null'] },
  profilePhotoKey: { type: ['string', 'null'] },
  skills: { type: 'array', items: { type: 'string' } },
  yearsOfExperience: { type: ['string', 'null'] },
  previousWorkExperience: { type: ['string', 'null'] },
  portfolioFileKey: { type: ['string', 'null'] },
  availableDays: { type: 'array', items: { type: 'string' } },
  availableToTravel: { type: ['boolean', 'null'] },
  hourlyRateBand: { type: ['string', 'null'] },
  projectRateBand: { type: ['string', 'null'] },
  ratingAvg: { type: ['number', 'null'] },
  ratingCount: { type: 'integer' },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

export const creativeProfileResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: creativeProfileProperties },
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

// -- Public talent search -----------------------------------------------------------------------

export const talentSearchQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    // Matched against primaryRole by case-sensitive prefix — see repository.ts's searchTalents.
    category: { type: 'string', minLength: 1, maxLength: 100 },
    location: { type: 'string', minLength: 1, maxLength: 200 },
    hourlyRateBand: { type: 'string', enum: HOURLY_RATE_BAND },
    availableToTravel: { type: 'boolean' },
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    cursor: objectIdSchema,
  },
} as const;

const publicTalentProperties = {
  accountId: { type: 'string' },
  primaryRole: { type: 'string' },
  location: { type: ['string', 'null'] },
  bio: { type: ['string', 'null'] },
  profilePhotoKey: { type: ['string', 'null'] },
  skills: { type: 'array', items: { type: 'string' } },
  availableDays: { type: 'array', items: { type: 'string' } },
  availableToTravel: { type: ['boolean', 'null'] },
  hourlyRateBand: { type: ['string', 'null'] },
  projectRateBand: { type: ['string', 'null'] },
  ratingAvg: { type: ['number', 'null'] },
  ratingCount: { type: 'integer' },
} as const;

export const publicTalentResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: publicTalentProperties },
  },
} as const;

export const publicTalentPageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: publicTalentProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;

export const accountIdParamsSchema = {
  type: 'object',
  required: ['accountId'],
  properties: { accountId: objectIdSchema },
} as const;

// -- Portfolio gallery ---------------------------------------------------------------------------

export const createPortfolioItemBodySchema = {
  type: 'object',
  required: ['fileId', 'mediaType'],
  additionalProperties: false,
  properties: {
    fileId: objectIdSchema,
    mediaType: { type: 'string', enum: PORTFOLIO_MEDIA_TYPE },
    title: { type: 'string', minLength: 1, maxLength: 200 },
  },
} as const;

export const pageQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    cursor: objectIdSchema,
  },
} as const;

export const portfolioItemIdParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: objectIdSchema },
} as const;

const portfolioItemProperties = {
  id: { type: 'string' },
  accountId: { type: 'string' },
  fileId: { type: 'string' },
  mediaType: { type: 'string', enum: PORTFOLIO_MEDIA_TYPE },
  title: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
} as const;

export const portfolioItemResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: portfolioItemProperties },
  },
} as const;

export const portfolioItemPageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: portfolioItemProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;

export const deletePortfolioItemResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
  },
} as const;

// -- Employer/company profile ---------------------------------------------------------------------

export const upsertEmployerProfileBodySchema = {
  type: 'object',
  required: ['companyName'],
  additionalProperties: false,
  properties: {
    companyName: { type: 'string', minLength: 1, maxLength: 200 },
    industry: { type: 'string', minLength: 1, maxLength: 100 },
    bio: { type: 'string', maxLength: 2000 },
    logoFileKey: { type: 'string', minLength: 1, maxLength: 1024 },
  },
} as const;

export const employerProfileResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        accountId: { type: 'string' },
        companyName: { type: 'string' },
        industry: { type: ['string', 'null'] },
        bio: { type: ['string', 'null'] },
        logoFileKey: { type: ['string', 'null'] },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  },
} as const;
