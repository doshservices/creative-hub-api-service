import type { FastifyInstance } from 'fastify';
import { WalletRepository } from './wallet.repository.js';
import { LedgerRepository } from './ledger.repository.js';
import { WalletService, type TransactionRunnerPort } from './service.js';
import { WalletController } from './controller.js';
import { registerWalletRoutes } from './routes.js';

export { WalletRepository } from './wallet.repository.js';
export { LedgerRepository } from './ledger.repository.js';
export { WalletService, DEFAULT_CURRENCY } from './service.js';
export type { MovementOptions, PageParams } from './service.js';
export type { WalletDTO, LedgerEntryDTO, LedgerPage } from './dto.js';

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
