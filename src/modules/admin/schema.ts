import { objectIdSchema } from '../../common/schema.js';

export const listQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    cursor: objectIdSchema,
  },
} as const;

const walletProperties = {
  balanceMinor: { type: 'integer' },
  heldMinor: { type: 'integer' },
  currency: { type: 'string' },
} as const;

const accountRowProperties = {
  accountId: { type: 'string' },
  email: { type: 'string' },
  firstName: { type: 'string' },
  lastName: { type: 'string' },
  accountType: { type: 'string', enum: ['client', 'creative'] },
  status: { type: 'string', enum: ['active', 'suspended'] },
  createdAt: { type: 'string' },
  kycStatus: { type: ['string', 'null'] },
  wallet: {
    type: ['object', 'null'],
    properties: walletProperties,
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

const employerProfileProperties = {
  id: { type: 'string' },
  accountId: { type: 'string' },
  companyName: { type: 'string' },
  industry: { type: ['string', 'null'] },
  bio: { type: ['string', 'null'] },
  logoFileKey: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

export const talentPageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ...accountRowProperties,
              profile: { type: ['object', 'null'], properties: creativeProfileProperties },
            },
          },
        },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;

export const employerPageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ...accountRowProperties,
              profile: { type: ['object', 'null'], properties: employerProfileProperties },
            },
          },
        },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;

export const statsResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        totalTalents: { type: 'integer' },
        totalEmployers: { type: 'integer' },
        activeListings: { type: 'integer' },
        listingsByCategory: { type: 'object', additionalProperties: { type: 'integer' } },
      },
    },
  },
} as const;
