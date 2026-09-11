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
      schema: {
        tags: ['Files'],
        summary: 'Get a presigned S3 upload URL for a new file',
        description:
          'The object is not recorded until the upload is confirmed via POST /:id/confirm. **Creative or client accounts** (requires `files:upload`, granted to both account types by default).',
        body: createUploadUrlBodySchema,
        response: { 201: uploadUrlResponseSchema },
      },
    },
    controller.createUploadUrl,
  );

  app.post<{ Params: FileIdParams }>(
    '/:id/confirm',
    {
      preHandler: [app.authenticate, requireFilesUpload],
      schema: {
        tags: ['Files'],
        summary: 'Confirm a completed upload',
        description: '**Creative or client accounts** (requires `files:upload`), owner only.',
        params: fileIdParamSchema,
        response: { 200: fileResponseSchema },
      },
    },
    controller.confirmUpload,
  );

  app.get<{ Params: FileIdParams }>(
    '/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Files'],
        summary: "Get one of the caller's files by id",
        description: '**Any account type**, owner only.',
        params: fileIdParamSchema,
        response: { 200: fileResponseSchema },
      },
    },
    controller.getMyFile,
  );

  app.get<{ Querystring: ListQuery }>(
    '/',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Files'],
        summary: "List the caller's own files",
        description: "**Any account type** — lists the caller's own files.",
        querystring: listQuerySchema,
        response: { 200: filePageResponseSchema },
      },
    },
    controller.listMyFiles,
  );

  app.get<{ Params: FileIdParams }>(
    '/:id/download-url',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Files'],
        summary: 'Get a presigned S3 download URL for a file',
        description: '**Any account type**, owner only.',
        params: fileIdParamSchema,
        response: { 200: downloadUrlResponseSchema },
      },
    },
    controller.createDownloadUrl,
  );
}
