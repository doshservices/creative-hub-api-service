import type { FastifyInstance } from 'fastify';
import type { LedgerQuery, WalletController, WalletQuery } from './controller.js';
import { ledgerPageResponseSchema, ledgerQuerySchema, walletQuerySchema, walletResponseSchema } from './schema.js';

export function registerWalletRoutes(app: FastifyInstance, controller: WalletController): void {
  app.get<{ Querystring: WalletQuery }>(
    '/me',
    {
      preHandler: app.authenticate,
      schema: { querystring: walletQuerySchema, response: { 200: walletResponseSchema } },
    },
    controller.getMyWallet,
  );

  app.get<{ Querystring: LedgerQuery }>(
    '/me/ledger',
    {
      preHandler: app.authenticate,
      schema: { querystring: ledgerQuerySchema, response: { 200: ledgerPageResponseSchema } },
    },
    controller.listMyLedger,
  );
}
