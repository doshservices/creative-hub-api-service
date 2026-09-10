import { objectIdSchema } from '../../common/schema.js';

export const contractIdParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: objectIdSchema },
} as const;

export const accountIdParamSchema = {
  type: 'object',
  required: ['accountId'],
  properties: { accountId: objectIdSchema },
} as const;

export const submitReviewBodySchema = {
  type: 'object',
  required: ['rating'],
  additionalProperties: false,
  properties: {
    rating: { type: 'integer', minimum: 1, maximum: 5 },
    comment: { type: 'string', minLength: 1, maxLength: 2000 },
  },
} as const;

export const listQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    cursor: objectIdSchema,
  },
} as const;

const reviewProperties = {
  id: { type: 'string' },
  contractId: { type: 'string' },
  reviewerAccountId: { type: 'string' },
  revieweeAccountId: { type: 'string' },
  rating: { type: 'integer' },
  comment: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
} as const;

export const reviewResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: reviewProperties },
  },
} as const;

export const reviewPageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: reviewProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;
