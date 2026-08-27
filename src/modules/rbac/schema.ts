import { objectIdSchema } from '../../common/schema.js';

export const createRoleBodySchema = {
  type: 'object',
  required: ['name', 'permissions'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 100 },
    permissions: { type: 'array', items: { type: 'string' }, minItems: 1, uniqueItems: true },
  },
} as const;

export const updateRolePermissionsBodySchema = {
  type: 'object',
  required: ['permissions'],
  additionalProperties: false,
  properties: {
    permissions: { type: 'array', items: { type: 'string' }, minItems: 1, uniqueItems: true },
  },
} as const;

export const assignRoleBodySchema = {
  type: 'object',
  required: ['roleId'],
  additionalProperties: false,
  properties: {
    roleId: objectIdSchema,
  },
} as const;

export const roleIdParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: objectIdSchema },
} as const;

export const accountIdParamSchema = {
  type: 'object',
  required: ['accountId'],
  properties: { accountId: objectIdSchema },
} as const;

export const listQuerySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    cursor: objectIdSchema,
  },
} as const;

export const permissionsCatalogResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: { permissions: { type: 'array', items: { type: 'string' } } } },
  },
} as const;

const roleProperties = {
  id: { type: 'string' },
  name: { type: 'string' },
  permissions: { type: 'array', items: { type: 'string' } },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

export const roleResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: roleProperties },
  },
} as const;

export const rolePageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: roleProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;

export const roleAssignmentResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        accountId: { type: 'string' },
        permissions: { type: 'array', items: { type: 'string' } },
      },
    },
  },
} as const;
