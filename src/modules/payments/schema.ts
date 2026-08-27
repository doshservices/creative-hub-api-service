import { objectIdSchema } from '../../common/schema.js';

export const initiateDepositBodySchema = {
  type: 'object',
  required: ['amountMinor'],
  additionalProperties: false,
  properties: {
    amountMinor: { type: 'integer', minimum: 1 },
    currency: { type: 'string', minLength: 3, maxLength: 3 },
  },
} as const;

export const initiateWithdrawalBodySchema = {
  type: 'object',
  required: ['amountMinor', 'bankCode', 'accountNumber'],
  additionalProperties: false,
  properties: {
    amountMinor: { type: 'integer', minimum: 1 },
    currency: { type: 'string', minLength: 3, maxLength: 3 },
    bankCode: { type: 'string', minLength: 1, maxLength: 10 },
    accountNumber: { type: 'string', minLength: 1, maxLength: 20 },
  },
} as const;

export const idParamSchema = {
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

// Loosely shaped on purpose: this is Flutterwave's payload, not client input we control the
// evolution of — see CLAUDE.md's validation invariant and the third-party-provider skill.
export const flutterwaveWebhookBodySchema = {
  type: 'object',
  required: ['event', 'data'],
  properties: {
    event: { type: 'string' },
    data: { type: 'object' },
  },
} as const;

const depositProperties = {
  id: { type: 'string' },
  accountId: { type: 'string' },
  amountMinor: { type: 'integer' },
  currency: { type: 'string' },
  txRef: { type: 'string' },
  checkoutUrl: { type: ['string', 'null'] },
  status: { type: 'string', enum: ['pending', 'awaiting_payment', 'completed', 'failed'] },
  failureReason: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

export const depositResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: depositProperties },
  },
} as const;

export const depositPageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: depositProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;

const withdrawalProperties = {
  id: { type: 'string' },
  accountId: { type: 'string' },
  amountMinor: { type: 'integer' },
  currency: { type: 'string' },
  reference: { type: 'string' },
  bankCode: { type: 'string' },
  accountNumber: { type: 'string' },
  status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
  failureReason: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

export const withdrawalResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: withdrawalProperties },
  },
} as const;

export const withdrawalPageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: withdrawalProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;
