import { objectIdSchema } from '../../common/schema.js';

const PAYMENT_TYPE = ['fixed', 'hourly'] as const;
const CURRENCY = ['NGN', 'USD'] as const;
const PROJECT_TYPE = ['remote', 'onsite', 'hybrid'] as const;
const LISTING_STATUS = ['draft', 'open', 'closed'] as const;

const budgetProperties = {
  category: { type: 'string', minLength: 1, maxLength: 100 },
  headcount: { type: 'integer', minimum: 1, default: 1 },
  projectType: { type: 'string', enum: PROJECT_TYPE },
  paymentType: { type: 'string', enum: PAYMENT_TYPE },
  // Integer minor units — e.g. 10000000 for ₦100,000. budgetMaxMinor >= budgetMinMinor is
  // validated in the service (this repo's ajv isn't configured with $data, so cross-field
  // comparisons aren't expressible in the JSON schema itself).
  budgetMinMinor: { type: 'integer', minimum: 1 },
  budgetMaxMinor: { type: 'integer', minimum: 1 },
  currency: { type: 'string', enum: CURRENCY },
  duration: { type: 'string', minLength: 1, maxLength: 200 },
} as const;

export const createListingBodySchema = {
  type: 'object',
  required: [
    'title',
    'description',
    'location',
    'category',
    'projectType',
    'paymentType',
    'budgetMinMinor',
    'budgetMaxMinor',
    'currency',
    'duration',
  ],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', minLength: 1, maxLength: 4000 },
    location: { type: 'string', minLength: 1, maxLength: 200 },
    ...budgetProperties,
    // Defaults to true (immediate publish) so existing callers that don't send it keep the old
    // "always open on create" behavior; pass publish:false to save a draft instead.
    publish: { type: 'boolean', default: true },
  },
} as const;

export const updateListingBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', minLength: 1, maxLength: 4000 },
    location: { type: 'string', minLength: 1, maxLength: 200 },
    ...budgetProperties,
    // Lets a draft be published as part of the same edit; ignored (no-op) once the listing is
    // already open or closed.
    publish: { type: 'boolean' },
  },
} as const;

export const listQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    cursor: objectIdSchema,
    search: { type: 'string', minLength: 1, maxLength: 200 },
    category: { type: 'string', minLength: 1, maxLength: 100 },
    location: { type: 'string', minLength: 1, maxLength: 200 },
    budgetMin: { type: 'integer', minimum: 0 },
    budgetMax: { type: 'integer', minimum: 0 },
  },
} as const;

export const flagListingBodySchema = {
  type: 'object',
  required: ['reason'],
  additionalProperties: false,
  properties: {
    reason: { type: 'string', minLength: 1, maxLength: 1000 },
  },
} as const;

const moderationProperties = {
  flagged: { type: 'boolean' },
  flaggedReason: { type: ['string', 'null'] },
  flaggedAt: { type: ['string', 'null'] },
} as const;

const listingProperties = {
  id: { type: 'string' },
  clientAccountId: { type: 'string' },
  title: { type: 'string' },
  description: { type: 'string' },
  location: { type: 'string' },
  category: { type: 'string' },
  headcount: { type: 'integer' },
  projectType: { type: 'string', enum: PROJECT_TYPE },
  paymentType: { type: 'string', enum: PAYMENT_TYPE },
  budgetMinMinor: { type: 'integer' },
  budgetMaxMinor: { type: 'integer' },
  currency: { type: 'string', enum: CURRENCY },
  duration: { type: 'string' },
  status: { type: 'string', enum: LISTING_STATUS },
  moderation: { type: 'object', properties: moderationProperties },
  applicantCount: { type: 'integer' },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

export const listingResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: listingProperties },
  },
} as const;

export const listingPageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: listingProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;

export const listingStatsResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        activeCount: { type: 'integer' },
        byCategory: { type: 'object', additionalProperties: { type: 'integer' } },
      },
    },
  },
} as const;
