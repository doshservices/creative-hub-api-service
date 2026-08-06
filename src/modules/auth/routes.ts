import type { FastifyInstance } from 'fastify';
import type { AuthController } from './controller.js';
import {
  accountResponseSchema,
  authTokensResponseSchema,
  loginBodySchema,
  refreshBodySchema,
  registerBodySchema,
} from './schema.js';

export function registerAuthRoutes(app: FastifyInstance, controller: AuthController): void {
  app.post(
    '/register',
    { schema: { body: registerBodySchema, response: { 201: authTokensResponseSchema } } },
    controller.register,
  );

  app.post(
    '/login',
    { schema: { body: loginBodySchema, response: { 200: authTokensResponseSchema } } },
    controller.login,
  );

  app.post(
    '/refresh',
    { schema: { body: refreshBodySchema, response: { 200: authTokensResponseSchema } } },
    controller.refresh,
  );

  app.post('/logout', { schema: { body: refreshBodySchema } }, controller.logout);

  app.get(
    '/me',
    { preHandler: app.authenticate, schema: { response: { 200: accountResponseSchema } } },
    controller.me,
  );
}
