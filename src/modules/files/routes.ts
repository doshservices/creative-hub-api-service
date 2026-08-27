import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import type {
  CreateUploadUrlBody,
  FileController,
  FileIdParams,
  ListQuery,
} from './controller.js';
import {
  createUploadUrlBodySchema,
  downloadUrlResponseSchema,
  fileIdParamSchema,
  filePageResponseSchema,
  fileResponseSchema,
  listQuerySchema,
  uploadUrlResponseSchema,
} from './schema.js';

export function registerFilesRoutes(app: FastifyInstance, controller: FileController): void {
  const requireFilesUpload = app.requirePermission(PERMISSIONS.FILES_UPLOAD);

  app.post<{ Body: CreateUploadUrlBody }>(
    '/upload-url',
    {
      preHandler: [app.authenticate, requireFilesUpload],
      schema: { body: createUploadUrlBodySchema, response: { 201: uploadUrlResponseSchema } },
    },
    controller.createUploadUrl,
  );

  app.post<{ Params: FileIdParams }>(
    '/:id/confirm',
    {
      preHandler: [app.authenticate, requireFilesUpload],
      schema: { params: fileIdParamSchema, response: { 200: fileResponseSchema } },
    },
    controller.confirmUpload,
  );

  app.get<{ Params: FileIdParams }>(
    '/:id',
    {
      preHandler: app.authenticate,
      schema: { params: fileIdParamSchema, response: { 200: fileResponseSchema } },
    },
    controller.getMyFile,
  );

  app.get<{ Querystring: ListQuery }>(
    '/',
    {
      preHandler: app.authenticate,
      schema: { querystring: listQuerySchema, response: { 200: filePageResponseSchema } },
    },
    controller.listMyFiles,
  );

  app.get<{ Params: FileIdParams }>(
    '/:id/download-url',
    {
      preHandler: app.authenticate,
      schema: { params: fileIdParamSchema, response: { 200: downloadUrlResponseSchema } },
    },
    controller.createDownloadUrl,
  );
}
