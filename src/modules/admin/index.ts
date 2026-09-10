import type { FastifyInstance } from 'fastify';
import { AccountRepository, countAccounts } from '../auth/index.js';
import { getEmployerProfilesByAccountIds, getManyByAccountIds } from '../users/index.js';
import { getStatusesByAccountIds } from '../identity/index.js';
import { getBalancesByAccountIds } from '../wallet/index.js';
import { getPlatformListingStats } from '../listings/index.js';
import { AdminService } from './service.js';
import { AdminController } from './controller.js';
import { registerAdminRoutes } from './routes.js';

export { AdminService } from './service.js';
export type {
  AdminAccountRowDTO,
  AdminEmployerRowDTO,
  AdminRowPage,
  AdminStatsDTO,
  AdminTalentRowDTO,
} from './dto.js';

// Thin, read-only composition layer: every mutation stays a route on the module that owns that
// data (auth for suspend/reactivate, listings for flag/unflag/close, identity for KYC
// approve/reject, payments for reversal). This module only stitches batch reads from each
// module's own index.ts — never imports another module's repository/model/internal service, per
// CLAUDE.md's cross-module rule.
//
// Not wrapped in fastify-plugin — needs its own encapsulated context for `{ prefix: '/admin' }`
// to apply, same reasoning as the other route-registering modules.
export default async function adminModule(app: FastifyInstance): Promise<void> {
  const db = app.mongo.db;
  // A second, independent AccountRepository instance against the same shared db — same pattern
  // hiring/payments use for wallet's WalletRepository/WalletService via createTransactionRunner.
  // createIndexes() is idempotent (createIndex is a no-op when the index already exists), so
  // this is safe even though auth's own module registration already created these indexes.
  const accountRepository = new AccountRepository(db);
  await accountRepository.createIndexes();

  const service = new AdminService(
    {
      list: (params) => accountRepository.list(params),
      count: (accountType) => countAccounts(db, accountType),
    },
    { getManyByAccountIds: (accountIds) => getManyByAccountIds(db, accountIds) },
    {
      getEmployerProfilesByAccountIds: (accountIds) =>
        getEmployerProfilesByAccountIds(db, accountIds),
    },
    { getStatusesByAccountIds: (accountIds) => getStatusesByAccountIds(db, accountIds) },
    { getBalancesByAccountIds: (accountIds) => getBalancesByAccountIds(db, accountIds) },
    { getPlatformListingStats: () => getPlatformListingStats(db) },
  );
  const controller = new AdminController(service);
  registerAdminRoutes(app, controller);
}
