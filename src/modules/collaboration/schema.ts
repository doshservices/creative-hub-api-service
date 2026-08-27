import { objectIdSchema } from '../../common/schema.js';

export const submitDeliverableBodySchema = {
  type: 'object',
  required: ['fileId'],
  additionalProperties: false,
  properties: {
    fileId: objectIdSchema,
    note: { type: 'string', maxLength: 2000 },
  },
} as const;

export const reviewDeliverableBodySchema = {
  type: 'object',
  required: ['status'],
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['approved', 'revision_requested'] },
    reviewNote: { type: 'string', maxLength: 2000 },
  },
} as const;

export const contractIdParamSchema = {
  type: 'object',
  required: ['contractId'],
  properties: { contractId: objectIdSchema },
} as const;

export const deliverableIdParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: objectIdSchema },
} as const;

export const listQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    cursor: objectIdSchema,
  },
} as const;

const deliverableProperties = {
  id: { type: 'string' },
  contractId: { type: 'string' },
  clientAccountId: { type: 'string' },
  creativeAccountId: { type: 'string' },
  fileId: { type: 'string' },
  note: { type: ['string', 'null'] },
  status: { type: 'string', enum: ['submitted', 'approved', 'revision_requested'] },
  reviewNote: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

export const deliverableResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: deliverableProperties },
  },
} as const;

export const deliverablePageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: deliverableProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;
