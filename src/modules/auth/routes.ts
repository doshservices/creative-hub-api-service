import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import { objectIdSchema } from '../../common/schema.js';
import type { AccountIdParams, AuthController, ChangePasswordBody } from './controller.js';
import {
  accountResponseSchema,
  authTokensResponseSchema,
  changePasswordBodySchema,
  loginBodySchema,
  refreshBodySchema,
  registerBodySchema,
} from './schema.js';

const accountIdParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: objectIdSchema },
} as const;

export function registerAuthRoutes(app: FastifyInstance, controller: AuthController): void {
  const requireAdminUsersManage = app.requirePermission(PERMISSIONS.ADMIN_USERS_MANAGE);

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

  app.put<{ Body: ChangePasswordBody }>(
    '/me/password',
    { preHandler: app.authenticate, schema: { body: changePasswordBodySchema } },
    controller.changePassword,
  );

  app.put<{ Params: AccountIdParams }>(
    '/admin/accounts/:id/suspend',
    {
      preHandler: [app.authenticate, requireAdminUsersManage],
      schema: { params: accountIdParamSchema, response: { 200: accountResponseSchema } },
    },
    controller.suspendAccount,
  );

  app.put<{ Params: AccountIdParams }>(
    '/admin/accounts/:id/reactivate',
    {
      preHandler: [app.authenticate, requireAdminUsersManage],
      schema: { params: accountIdParamSchema, response: { 200: accountResponseSchema } },
    },
    controller.reactivateAccount,
  );
}
