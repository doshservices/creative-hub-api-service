const APPLICATION_STATUS = ['pending', 'interview_requested', 'accepted', 'rejected'] as const;
const CONTRACT_STATUS = ['active', 'completed', 'cancelled'] as const;

export const applyBodySchema = {
  type: 'object',
  required: ['listingId'],
  additionalProperties: false,
  properties: {
    listingId: { type: 'string', minLength: 1 },
    message: { type: 'string', maxLength: 2000 },
  },
} as const;

// Only the transitions a client is allowed to drive — never back to 'pending'.
export const updateApplicationStatusBodySchema = {
  type: 'object',
  required: ['status'],
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['interview_requested', 'accepted', 'rejected'] },
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

const applicationProperties = {
  id: { type: 'string' },
  listingId: { type: 'string' },
  clientAccountId: { type: 'string' },
  creativeAccountId: { type: 'string' },
  status: { type: 'string', enum: APPLICATION_STATUS },
  message: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

export const applicationResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: applicationProperties },
  },
} as const;

export const applicationPageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: applicationProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;

const contractProperties = {
  id: { type: 'string' },
  listingId: { type: 'string' },
  applicationId: { type: 'string' },
  clientAccountId: { type: 'string' },
  creativeAccountId: { type: 'string' },
  status: { type: 'string', enum: CONTRACT_STATUS },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

export const contractPageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: contractProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;
