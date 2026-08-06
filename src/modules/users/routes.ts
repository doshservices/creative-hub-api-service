import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import type {
  CreateUploadUrlBody,
  UpsertCreativeProfileBody,
  UsersController,
} from './controller.js';
import {
  createUploadUrlBodySchema,
  creativeProfileResponseSchema,
  upsertCreativeProfileBodySchema,
  uploadUrlResponseSchema,
} from './schema.js';

export function registerUsersRoutes(app: FastifyInstance, controller: UsersController): void {
  const requireCreativeProfileWrite = app.requirePermission(PERMISSIONS.CREATIVE_PROFILE_WRITE);

  app.get(
    '/me/creative-profile',
    { preHandler: app.authenticate, schema: { response: { 200: creativeProfileResponseSchema } } },
    controller.getMyCreativeProfile,
  );

  app.put<{ Body: UpsertCreativeProfileBody }>(
    '/me/creative-profile',
    {
      preHandler: [app.authenticate, requireCreativeProfileWrite],
      schema: {
        body: upsertCreativeProfileBodySchema,
        response: { 200: creativeProfileResponseSchema },
      },
    },
    controller.upsertMyCreativeProfile,
  );

  app.post<{ Body: CreateUploadUrlBody }>(
    '/me/creative-profile/upload-url',
    {
      preHandler: [app.authenticate, requireCreativeProfileWrite],
      schema: { body: createUploadUrlBodySchema, response: { 201: uploadUrlResponseSchema } },
    },
    controller.createUploadUrl,
  );
}
