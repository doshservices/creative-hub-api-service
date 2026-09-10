import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import type {
  AdminLedgerQuery,
  LedgerQuery,
  SummaryQuery,
  WalletController,
  WalletQuery,
} from './controller.js';
import {
  adminLedgerQuerySchema,
  ledgerPageResponseSchema,
  ledgerQuerySchema,
  summaryQuerySchema,
  walletQuerySchema,
  walletResponseSchema,
  walletSummaryResponseSchema,
} from './schema.js';

export function registerWalletRoutes(app: FastifyInstance, controller: WalletController): void {
  const requireWalletAdmin = app.requirePermission(PERMISSIONS.WALLET_ADMIN);

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

  app.get<{ Querystring: SummaryQuery }>(
    '/me/summary',
    {
      preHandler: app.authenticate,
      schema: { querystring: summaryQuerySchema, response: { 200: walletSummaryResponseSchema } },
    },
    controller.getMySummary,
  );

  // Cross-account, read-only — gated by WALLET_ADMIN, not ownership (there is no single owner).
  app.get<{ Querystring: AdminLedgerQuery }>(
    '/admin/ledger',
    {
      preHandler: [app.authenticate, requireWalletAdmin],
      schema: { querystring: adminLedgerQuerySchema, response: { 200: ledgerPageResponseSchema } },
    },
    controller.listAdminLedger,
  );
}
