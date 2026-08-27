import { objectIdSchema } from '../../common/schema.js';

// A general-purpose allowlist for this module — not tailored to any one caller's use case (see
// users/schema.ts's narrower, purpose-specific list for its own inline profile-photo/portfolio
// upload flow, which is separate from this module).
export const UPLOAD_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'video/mp4',
] as const;

// Callers namespace their own purposes (e.g. "contract-deliverable", "dispute-evidence")
// without this module needing to know about them — restricted to safe S3-key characters.
const PURPOSE_PATTERN = '^[a-z0-9-]{1,64}$';

export const createUploadUrlBodySchema = {
  type: 'object',
  required: ['purpose', 'contentType'],
  additionalProperties: false,
  properties: {
    purpose: { type: 'string', pattern: PURPOSE_PATTERN },
    contentType: { type: 'string', enum: UPLOAD_CONTENT_TYPES },
  },
} as const;

export const fileIdParamSchema = {
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

const fileProperties = {
  id: { type: 'string' },
  ownerId: { type: 'string' },
  key: { type: 'string' },
  purpose: { type: 'string' },
  contentType: { type: 'string' },
  status: { type: 'string', enum: ['pending', 'confirmed'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

export const fileResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: fileProperties },
  },
} as const;

export const filePageResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: fileProperties } },
        nextCursor: { type: ['string', 'null'] },
      },
    },
  },
} as const;

export const uploadUrlResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        key: { type: 'string' },
        uploadUrl: { type: 'string' },
      },
    },
  },
} as const;

export const downloadUrlResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: { type: 'object', properties: { downloadUrl: { type: 'string' } } },
  },
} as const;
