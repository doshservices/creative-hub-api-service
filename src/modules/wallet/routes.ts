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
      schema: {
        tags: ['Wallet'],
        summary: "Get the caller's wallet balance",
        description: '**Any account type** — every account has its own wallet.',
        querystring: walletQuerySchema,
        response: { 200: walletResponseSchema },
      },
    },
    controller.getMyWallet,
  );

  app.get<{ Querystring: LedgerQuery }>(
    '/me/ledger',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Wallet'],
        summary: "List the caller's ledger entries",
        description: '**Any account type.**',
        querystring: ledgerQuerySchema,
        response: { 200: ledgerPageResponseSchema },
      },
    },
    controller.listMyLedger,
  );

  app.get<{ Querystring: SummaryQuery }>(
    '/me/summary',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Wallet'],
        summary: "Get the caller's available/held/total-earned summary",
        description: '**Any account type.**',
        querystring: summaryQuerySchema,
        response: { 200: walletSummaryResponseSchema },
      },
    },
    controller.getMySummary,
  );

  // Cross-account, read-only — gated by WALLET_ADMIN, not ownership (there is no single owner).
  app.get<{ Querystring: AdminLedgerQuery }>(
    '/admin/ledger',
    {
      preHandler: [app.authenticate, requireWalletAdmin],
      schema: {
        tags: ['Wallet', 'Admin'],
        summary: 'List ledger entries across every account',
        description:
          '**Admin only** — requires `wallet:admin`, granted via an RBAC role assignment rather than by account type.',
        querystring: adminLedgerQuerySchema,
        response: { 200: ledgerPageResponseSchema },
      },
    },
    controller.listAdminLedger,
  );
}
