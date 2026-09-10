export const adminAuditQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: { type: 'string', minLength: 1, maxLength: 100 },
    actorId: { type: 'string', pattern: '^[a-f0-9]{24}$' },
    from: { type: 'string', format: 'date-time' },
    to: { type: 'string', format: 'date-time' },
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    cursor: { type: 'string', pattern: '^[a-f0-9]{24}$' },
  },
} as const;

const auditEntryProperties = {
  id: { type: 'string' },
  actorId: { type: 'string' },
  action: { type: 'string' },
  targetType: { type: 'string' },
  targetId: { type: 'string' },
  metadata: { type: 'object' },
  createdAt: { type: 'string' },
} as const;

export const auditEntryPageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: auditEntryProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;
