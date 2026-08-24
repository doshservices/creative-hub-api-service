import { objectIdSchema } from '../../common/schema.js';

export const sendMessageBodySchema = {
  type: 'object',
  required: ['recipientAccountId', 'content'],
  additionalProperties: false,
  properties: {
    recipientAccountId: objectIdSchema,
    content: { type: 'string', minLength: 1, maxLength: 4000 },
  },
} as const;

// Conversations paginate on an opaque base64url cursor (see conversation.repository.ts's
// encodeCursor) — not a bare ObjectId, unlike every other list in this codebase — so it can't
// share the objectIdSchema pattern used below for messages.
export const conversationListQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    cursor: { type: 'string', minLength: 1 },
  },
} as const;

export const messageListQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    cursor: objectIdSchema,
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
