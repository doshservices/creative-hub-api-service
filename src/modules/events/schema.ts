import { objectIdSchema } from '../../common/schema.js';

const EVENT_TYPE = ['casting_call', 'meetup', 'virtual_event'] as const;

export const createEventBodySchema = {
  type: 'object',
  required: ['title', 'description', 'eventType', 'category', 'location', 'startsAt', 'capacity'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', minLength: 1, maxLength: 4000 },
    eventType: { type: 'string', enum: EVENT_TYPE },
    category: { type: 'string', minLength: 1, maxLength: 100 },
    location: { type: 'string', minLength: 1, maxLength: 200 },
    startsAt: { type: 'string', format: 'date-time' },
    capacity: { type: 'integer', minimum: 1 },
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

export const browseEventsQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    cursor: objectIdSchema,
    search: { type: 'string', minLength: 1, maxLength: 200 },
    location: { type: 'string', minLength: 1, maxLength: 200 },
    eventType: { type: 'string', enum: EVENT_TYPE },
  },
} as const;

const eventProperties = {
  id: { type: 'string' },
  organizerAccountId: { type: 'string' },
  title: { type: 'string' },
  description: { type: 'string' },
  eventType: { type: 'string', enum: EVENT_TYPE },
  category: { type: 'string' },
  location: { type: 'string' },
  startsAt: { type: 'string' },
  capacity: { type: 'integer' },
  attendeeCount: { type: 'integer' },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

export const eventResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: eventProperties },
  },
} as const;

export const eventPageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: eventProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;
