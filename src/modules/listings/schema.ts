const PAYMENT_TYPE = ['fixed', 'hourly'] as const;
const CURRENCY = ['NGN', 'USD'] as const;

export const createListingBodySchema = {
  type: 'object',
  required: [
    'title',
    'description',
    'location',
    'paymentType',
    'amountMinor',
    'currency',
    'duration',
  ],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', minLength: 1, maxLength: 4000 },
    location: { type: 'string', minLength: 1, maxLength: 200 },
    paymentType: { type: 'string', enum: PAYMENT_TYPE },
    // Integer minor units — e.g. 10000000 for ₦100,000.
    amountMinor: { type: 'integer', minimum: 1 },
    currency: { type: 'string', enum: CURRENCY },
    duration: { type: 'string', minLength: 1, maxLength: 200 },
  },
} as const;

export const listQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    cursor: { type: 'string', minLength: 1 },
  },
} as const;

const listingProperties = {
  id: { type: 'string' },
  clientAccountId: { type: 'string' },
  title: { type: 'string' },
  description: { type: 'string' },
  location: { type: 'string' },
  paymentType: { type: 'string', enum: PAYMENT_TYPE },
  amountMinor: { type: 'integer' },
  currency: { type: 'string', enum: CURRENCY },
  duration: { type: 'string' },
  status: { type: 'string', enum: ['open', 'closed'] },
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
