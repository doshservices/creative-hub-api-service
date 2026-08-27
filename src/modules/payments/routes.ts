import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError } from '../../common/errors.js';
import { PERMISSIONS } from '../../common/permissions.js';
import type {
  FlutterwaveWebhookBody,
  IdParams,
  InitiateDepositBody,
  InitiateWithdrawalBody,
  ListQuery,
  PaymentsController,
} from './controller.js';
import {
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

  app.post<{ Body: InitiateDepositBody }>(
    '/deposits',
    {
      preHandler: [app.authenticate, requirePaymentsInitiate],
      schema: { body: initiateDepositBodySchema, response: { 201: depositResponseSchema } },
    },
    controller.initiateDeposit,
  );

  app.get<{ Params: IdParams }>(
    '/deposits/:id',
    {
      preHandler: app.authenticate,
      schema: { params: idParamSchema, response: { 200: depositResponseSchema } },
    },
    controller.getMyDeposit,
  );

  app.get<{ Querystring: ListQuery }>(
    '/deposits',
    {
      preHandler: app.authenticate,
      schema: { querystring: listQuerySchema, response: { 200: depositPageResponseSchema } },
    },
    controller.listMyDeposits,
  );

  app.post<{ Body: InitiateWithdrawalBody }>(
    '/withdrawals',
    {
      preHandler: [app.authenticate, requirePaymentsInitiate],
      schema: { body: initiateWithdrawalBodySchema, response: { 201: withdrawalResponseSchema } },
    },
    controller.initiateWithdrawal,
  );

  app.get<{ Params: IdParams }>(
    '/withdrawals/:id',
    {
      preHandler: app.authenticate,
      schema: { params: idParamSchema, response: { 200: withdrawalResponseSchema } },
    },
    controller.getMyWithdrawal,
  );

  app.get<{ Querystring: ListQuery }>(
    '/withdrawals',
    {
      preHandler: app.authenticate,
      schema: { querystring: listQuerySchema, response: { 200: withdrawalPageResponseSchema } },
    },
    controller.listMyWithdrawals,
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
      schema: { body: flutterwaveWebhookBodySchema },
    },
    controller.handleWebhook,
  );
}
