import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError } from '../../common/errors.js';
import { PERMISSIONS } from '../../common/permissions.js';
import type {
  AdminDepositListQuery,
  AdminWithdrawalListQuery,
  FlutterwaveWebhookBody,
  IdParams,
  InitiateDepositBody,
  InitiateWithdrawalBody,
  ListQuery,
  PaymentsController,
} from './controller.js';
import {
  adminDepositQuerySchema,
  adminWithdrawalQuerySchema,
  depositPageResponseSchema,
  depositResponseSchema,
  flutterwaveWebhookBodySchema,
  idParamSchema,
  initiateDepositBodySchema,
  initiateWithdrawalBodySchema,
  listQuerySchema,
  withdrawalPageResponseSchema,
  withdrawalResponseSchema,
} from './schema.js';
import { isValidFlutterwaveWebhook } from './webhook-auth.js';

export function registerPaymentsRoutes(
  app: FastifyInstance,
  controller: PaymentsController,
  webhookSecretHash: string,
): void {
  const requirePaymentsInitiate = app.requirePermission(PERMISSIONS.PAYMENTS_INITIATE);
  const requirePaymentsAdmin = app.requirePermission(PERMISSIONS.PAYMENTS_ADMIN);

  app.post<{ Body: InitiateDepositBody }>(
    '/deposits',
    {
      preHandler: [app.authenticate, requirePaymentsInitiate],
      schema: {
        tags: ['Payments'],
        summary: 'Initiate a deposit',
        description:
          '**Creative or client accounts** (requires `payments:initiate`, granted to both account types by default).',
        body: initiateDepositBodySchema,
        response: { 201: depositResponseSchema },
      },
    },
    controller.initiateDeposit,
  );

  app.get<{ Params: IdParams }>(
    '/deposits/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Payments'],
        summary: 'Get a deposit by id',
        description: '**Any account type**, owner only.',
        params: idParamSchema,
        response: { 200: depositResponseSchema },
      },
    },
    controller.getMyDeposit,
  );

  app.get<{ Querystring: ListQuery }>(
    '/deposits',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Payments'],
        summary: "List the caller's own deposits",
        description: "**Any account type** — lists the caller's own deposits.",
        querystring: listQuerySchema,
        response: { 200: depositPageResponseSchema },
      },
    },
    controller.listMyDeposits,
  );

  app.post<{ Body: InitiateWithdrawalBody }>(
    '/withdrawals',
    {
      preHandler: [app.authenticate, requirePaymentsInitiate],
      schema: {
        tags: ['Payments'],
        summary: 'Initiate a withdrawal',
        description: '**Creative or client accounts** (requires `payments:initiate`).',
        body: initiateWithdrawalBodySchema,
        response: { 201: withdrawalResponseSchema },
      },
    },
    controller.initiateWithdrawal,
  );

  app.get<{ Params: IdParams }>(
    '/withdrawals/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Payments'],
        summary: 'Get a withdrawal by id',
        description: '**Any account type**, owner only.',
        params: idParamSchema,
        response: { 200: withdrawalResponseSchema },
      },
    },
    controller.getMyWithdrawal,
  );

  app.get<{ Querystring: ListQuery }>(
    '/withdrawals',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Payments'],
        summary: "List the caller's own withdrawals",
        description: "**Any account type** — lists the caller's own withdrawals.",
        querystring: listQuerySchema,
        response: { 200: withdrawalPageResponseSchema },
      },
    },
    controller.listMyWithdrawals,
  );

  // Admin, cross-account — gated by PAYMENTS_ADMIN, not ownership (there is no single owner).
  app.get<{ Querystring: AdminDepositListQuery }>(
    '/admin/deposits',
    {
      preHandler: [app.authenticate, requirePaymentsAdmin],
      schema: {
        tags: ['Payments', 'Admin'],
        summary: 'List deposits across every account',
        description:
          '**Admin only** — requires `payments:admin`, granted via an RBAC role assignment rather than by account type.',
        querystring: adminDepositQuerySchema,
        response: { 200: depositPageResponseSchema },
      },
    },
    controller.listAdminDeposits,
  );

  app.get<{ Querystring: AdminWithdrawalListQuery }>(
    '/admin/withdrawals',
    {
      preHandler: [app.authenticate, requirePaymentsAdmin],
      schema: {
        tags: ['Payments', 'Admin'],
        summary: 'List withdrawals across every account',
        description: '**Admin only** — requires `payments:admin`.',
        querystring: adminWithdrawalQuerySchema,
        response: { 200: withdrawalPageResponseSchema },
      },
    },
    controller.listAdminWithdrawals,
  );

  app.post<{ Params: IdParams }>(
    '/admin/withdrawals/:id/reverse',
    {
      preHandler: [app.authenticate, requirePaymentsAdmin],
      schema: {
        tags: ['Payments', 'Admin'],
        summary: 'Reverse a completed withdrawal (refund)',
        description: '**Admin only** — requires `payments:admin`.',
        params: idParamSchema,
        response: { 200: withdrawalResponseSchema },
      },
    },
    controller.reverseWithdrawal,
  );

  // Public: Flutterwave calls this directly, so there is no JWT to authenticate — the
  // `verif-hash` header is the only trust boundary here. See webhook-auth.ts and the
  // third-party-provider skill's webhook-signature rule.
  app.post<{ Body: FlutterwaveWebhookBody }>(
    '/webhooks/flutterwave',
    {
      preHandler: async (request: FastifyRequest, _reply: FastifyReply) => {
        if (!isValidFlutterwaveWebhook(request.headers['verif-hash'], webhookSecretHash)) {
          throw new ForbiddenError('Invalid webhook signature');
        }
      },
      schema: {
        tags: ['Payments'],
        summary: 'Flutterwave payment/transfer webhook',
        description:
          "Called by Flutterwave itself, not a client — authenticated via the `verif-hash` signature header rather than a bearer token.",
        security: [],
        body: flutterwaveWebhookBodySchema,
      },
    },
    controller.handleWebhook,
  );
}
