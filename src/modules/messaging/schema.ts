export const sendMessageBodySchema = {
  type: 'object',
  required: ['recipientAccountId', 'content'],
  additionalProperties: false,
  properties: {
    recipientAccountId: { type: 'string', minLength: 1 },
    content: { type: 'string', minLength: 1, maxLength: 4000 },
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

const conversationProperties = {
  id: { type: 'string' },
  otherAccountId: { type: 'string' },
  lastMessageAt: { type: 'string' },
  lastMessagePreview: { type: 'string' },
  unreadCount: { type: 'integer' },
} as const;

export const conversationPageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: conversationProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;

const messageProperties = {
  id: { type: 'string' },
  conversationId: { type: 'string' },
  senderAccountId: { type: 'string' },
  content: { type: 'string' },
  createdAt: { type: 'string' },
} as const;

export const messageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: messageProperties },
  },
} as const;

export const messagePageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: messageProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;
