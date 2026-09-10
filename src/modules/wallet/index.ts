import type { Db } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import { WalletRepository } from './wallet.repository.js';
import { LedgerRepository } from './ledger.repository.js';
import { WalletService, DEFAULT_CURRENCY, type TransactionRunnerPort } from './service.js';
import { WalletController } from './controller.js';
import { registerWalletRoutes } from './routes.js';

export { WalletRepository } from './wallet.repository.js';
export { LedgerRepository } from './ledger.repository.js';
export { WalletService, DEFAULT_CURRENCY } from './service.js';
export type { MovementOptions, PageParams, AdminLedgerPageParams } from './service.js';
export type { WalletDTO, LedgerEntryDTO, LedgerPage, WalletSummaryDTO } from './dto.js';

// Batch balance lookup for other modules to compose (e.g. a future admin module's Manage
// Talents/Employers tables) — constructs its own WalletRepository against the shared
// app.mongo.db, the same cross-module convention payments/index.ts already uses for
// WalletRepository/LedgerRepository/WalletService, rather than reaching into a decorated
// instance from inside another module's encapsulated registration.
export async function getBalancesByAccountIds(
  db: Db,
  accountIds: string[],
  currency: string = DEFAULT_CURRENCY,
): Promise<Record<string, { balanceMinor: number; heldMinor: number; currency: string }>> {
  return new WalletRepository(db).getBalancesByAccountIds(accountIds, currency);
}

// Not wrapped in fastify-plugin — needs its own encapsulated context for `{ prefix: '/wallet' }`
// to apply, same reasoning as the other route-registering modules.
export default async function walletModule(app: FastifyInstance): Promise<void> {
  const walletRepository = new WalletRepository(app.mongo.db);
  await walletRepository.createIndexes();

  const ledgerRepository = new LedgerRepository(app.mongo.db);
  await ledgerRepository.createIndexes();

  // Backs credit/debit/hold/transfer: each runs its balance delta and ledger insert inside one
  // Mongo session so they commit or roll back together — see the mongo-data-layer skill on
  // transactions. Requires Mongo to be a replica set (Atlas always is; local dev's
  // docker-compose runs a single-node replica set for the same reason).
  const transactionRunner = createTransactionRunner(app);

  const service = new WalletService(walletRepository, ledgerRepository, transactionRunner, app.audit);
  const controller = new WalletController(service);
  registerWalletRoutes(app, controller);
}

// Other modules (payments, and eventually hiring for escrow payout) construct their own
// WalletService from these exports against the shared app.mongo.db/client — the same pattern
// hiring uses for listings' ListingRepository — rather than reaching into a decorated instance
// from inside another module's encapsulated registration.
export function createTransactionRunner(app: FastifyInstance): TransactionRunnerPort {
  return {
    async withTransaction(fn) {
      const session = app.mongo.client.startSession();
      try {
        return await session.withTransaction(() => fn(session));
      } finally {
        await session.endSession();
      }
    },
  };
}
