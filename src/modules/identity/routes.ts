import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import type { IdentityController, SubmitVerificationBody } from './controller.js';
import { submitVerificationBodySchema, verificationResponseSchema } from './schema.js';

export function registerIdentityRoutes(app: FastifyInstance, controller: IdentityController): void {
  const requireIdentityVerify = app.requirePermission(PERMISSIONS.IDENTITY_VERIFY);

  app.post<{ Body: SubmitVerificationBody }>(
    '/verifications',
    {
      preHandler: [app.authenticate, requireIdentityVerify],
      schema: {
        body: submitVerificationBodySchema,
        response: { 201: verificationResponseSchema },
      },
    },
    controller.submitVerification,
  );

  app.get(
    '/verifications/me',
    { preHandler: app.authenticate, schema: { response: { 200: verificationResponseSchema } } },
    controller.getMyVerification,
  );
}
