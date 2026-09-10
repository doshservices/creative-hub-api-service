import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import { objectIdSchema } from '../../common/schema.js';
import type {
  IdentityController,
  ListVerificationsQuery,
  RejectVerificationBody,
  SubmitVerificationBody,
  VerificationIdParams,
} from './controller.js';
import {
  listVerificationsQuerySchema,
  rejectVerificationBodySchema,
  submitVerificationBodySchema,
  verificationPageResponseSchema,
  verificationResponseSchema,
} from './schema.js';

const verificationIdParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: objectIdSchema },
} as const;

export function registerIdentityRoutes(app: FastifyInstance, controller: IdentityController): void {
  const requireIdentityVerify = app.requirePermission(PERMISSIONS.IDENTITY_VERIFY);
  const requireIdentityReview = app.requirePermission(PERMISSIONS.IDENTITY_REVIEW);

  app.post<{ Body: SubmitVerificationBody }>(
    '/verifications',
    {
      preHandler: [app.authenticate, requireIdentityVerify],
      schema: {
        tags: ['Identity (KYC)'],
        summary: 'Submit a KYC verification',
        body: submitVerificationBodySchema,
        response: { 201: verificationResponseSchema },
      },
    },
    controller.submitVerification,
  );

  app.get(
    '/verifications/me',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Identity (KYC)'],
        summary: "Get the caller's KYC status",
        response: { 200: verificationResponseSchema },
      },
    },
    controller.getMyVerification,
  );

  // Admin manual-review queue — alongside the Prembly webhook path, not a replacement for it.
  app.get<{ Querystring: ListVerificationsQuery }>(
    '/admin/verifications',
    {
      preHandler: [app.authenticate, requireIdentityReview],
      schema: {
        tags: ['Identity (KYC)', 'Admin'],
        summary: 'List KYC verifications, optionally filtered by status',
        querystring: listVerificationsQuerySchema,
        response: { 200: verificationPageResponseSchema },
      },
    },
    controller.listVerifications,
  );

  app.put<{ Params: VerificationIdParams }>(
    '/admin/verifications/:id/approve',
    {
      preHandler: [app.authenticate, requireIdentityReview],
      schema: {
        tags: ['Identity (KYC)', 'Admin'],
        summary: 'Approve a KYC verification',
        params: verificationIdParamSchema,
        response: { 200: verificationResponseSchema },
      },
    },
    controller.approveVerification,
  );

  app.put<{ Params: VerificationIdParams; Body: RejectVerificationBody }>(
    '/admin/verifications/:id/reject',
    {
      preHandler: [app.authenticate, requireIdentityReview],
      schema: {
        tags: ['Identity (KYC)', 'Admin'],
        summary: 'Reject a KYC verification',
        params: verificationIdParamSchema,
        body: rejectVerificationBodySchema,
        response: { 200: verificationResponseSchema },
      },
    },
    controller.rejectVerification,
  );
}
