import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import type { IdentityController, SubmitVerificationBody } from './controller.js';
import { submitVerificationBodySchema, verificationResponseSchema } from './schema.js';

export async function registerIdentityRoutes(
  app: FastifyInstance,
  controller: IdentityController,
): Promise<void> {
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

  // Raw-body scope: signature verification needs the exact bytes Prembly signed, so this nested
  // register overrides the JSON parser to hand back a Buffer instead of a parsed object —
  // scoped to just this route, not the rest of the module (see provider.ts for the HMAC check).
  await app.register(function webhookScope(scope) {
    scope.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_request, body, done) => {
        done(null, body);
      },
    );
    scope.post('/webhooks/prembly', {}, controller.handlePremblyWebhook);
  });
}
