import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import { objectIdSchema } from '../../common/schema.js';
import type {
  AccountIdParams,
  AuthController,
  ChangePasswordBody,
  DisableTwoFactorBody,
  EnableTwoFactorBody,
  VerifyTwoFactorLoginBody,
} from './controller.js';
import {
  accountResponseSchema,
  authTokensResponseSchema,
  changePasswordBodySchema,
  disableTwoFactorBodySchema,
  enableTwoFactorBodySchema,
  enableTwoFactorResponseSchema,
  loginBodySchema,
  loginResponseSchema,
  refreshBodySchema,
  registerBodySchema,
  setupTwoFactorResponseSchema,
  verifyTwoFactorLoginBodySchema,
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
    {
      schema: {
        tags: ['Auth'],
        summary: 'Register a new account',
        security: [],
        body: registerBodySchema,
        response: { 201: authTokensResponseSchema },
      },
    },
    controller.register,
  );

  app.post(
    '/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Log in with email and password',
        description:
          "Returns access/refresh tokens directly, or `{ requiresTwoFactor: true, twoFactorToken }` if the account has 2FA enabled — complete the login with POST /auth/login/verify-2fa in that case.",
        security: [],
        body: loginBodySchema,
        response: { 200: loginResponseSchema },
      },
    },
    controller.login,
  );

  app.post<{ Body: VerifyTwoFactorLoginBody }>(
    '/login/verify-2fa',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Complete login with a two-factor code',
        description: 'Accepts either a 6-digit authenticator code or a one-time backup code.',
        security: [],
        body: verifyTwoFactorLoginBodySchema,
        response: { 200: authTokensResponseSchema },
      },
    },
    controller.verifyTwoFactorLogin,
  );

  app.post(
    '/refresh',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Exchange a refresh token for a new access/refresh pair',
        security: [],
        body: refreshBodySchema,
        response: { 200: authTokensResponseSchema },
      },
    },
    controller.refresh,
  );

  app.post(
    '/logout',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Invalidate a refresh token',
        security: [],
        body: refreshBodySchema,
      },
    },
    controller.logout,
  );

  app.get(
    '/me',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Auth'],
        summary: 'Get the authenticated account',
        response: { 200: accountResponseSchema },
      },
    },
    controller.me,
  );

  app.put<{ Body: ChangePasswordBody }>(
    '/me/password',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Auth'],
        summary: "Change the authenticated account's password",
        body: changePasswordBodySchema,
      },
    },
    controller.changePassword,
  );

  app.post(
    '/2fa/setup',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Auth'],
        summary: 'Start two-factor setup',
        description:
          'Generates a new TOTP secret and returns it plus an otpauth:// URL for a QR code. Not active until confirmed via POST /auth/2fa/enable.',
        response: { 200: setupTwoFactorResponseSchema },
      },
    },
    controller.setupTwoFactor,
  );

  app.post<{ Body: EnableTwoFactorBody }>(
    '/2fa/enable',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Auth'],
        summary: 'Confirm a code and enable two-factor auth',
        description:
          'Returns 8 one-time backup codes — shown exactly once, store them now. Requires a prior POST /auth/2fa/setup.',
        body: enableTwoFactorBodySchema,
        response: { 200: enableTwoFactorResponseSchema },
      },
    },
    controller.enableTwoFactor,
  );

  app.post<{ Body: DisableTwoFactorBody }>(
    '/2fa/disable',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Auth'],
        summary: 'Disable two-factor auth',
        description: 'Requires both the current password and a valid TOTP or backup code.',
        body: disableTwoFactorBodySchema,
      },
    },
    controller.disableTwoFactor,
  );

  app.put<{ Params: AccountIdParams }>(
    '/admin/accounts/:id/suspend',
    {
      preHandler: [app.authenticate, requireAdminUsersManage],
      schema: {
        tags: ['Auth', 'Admin'],
        summary: 'Suspend an account',
        params: accountIdParamSchema,
        response: { 200: accountResponseSchema },
      },
    },
    controller.suspendAccount,
  );

  app.put<{ Params: AccountIdParams }>(
    '/admin/accounts/:id/reactivate',
    {
      preHandler: [app.authenticate, requireAdminUsersManage],
      schema: {
        tags: ['Auth', 'Admin'],
        summary: 'Reactivate a suspended account',
        params: accountIdParamSchema,
        response: { 200: accountResponseSchema },
      },
    },
    controller.reactivateAccount,
  );
}
