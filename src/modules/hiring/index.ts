import type { Db } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import { AccountRepository } from '../auth/index.js';
import { ListingRepository } from '../listings/index.js';
import { WalletRepository, LedgerRepository, WalletService, createTransactionRunner } from '../wallet/index.js';
import { ApplicationRepository } from './application.repository.js';
import { ContractRepository } from './contract.repository.js';
import { InvitationRepository } from './invitation.repository.js';
import { HiringService } from './service.js';
import { HiringController } from './controller.js';
import { registerHiringRoutes } from './routes.js';

export { ContractRepository } from './contract.repository.js';
export { ApplicationRepository } from './application.repository.js';
export type { ContractDTO, ContractPage, ApplicationDTO, ApplicationPage } from './dto.js';

// Batch export for `listings`' future applicant-count reconciliation job — a real aggregation
// over hiring's own applications collection, matching exactly what the
// application.created/application.withdrawn event handler increments/decrements (see
// application.repository.ts's countActiveByListingIds and listings/events.ts).
export async function getApplicationCountsByListingIds(
  db: Db,
  listingIds: string[],
): Promise<Record<string, number>> {
  return new ApplicationRepository(db).countActiveByListingIds(listingIds);
}

// For a future `reviews` module's eligibility check (contract must be 'completed', caller must
// be one of its two parties) — nothing calls this yet.
export async function getContractById(db: Db, id: string) {
  return new ContractRepository(db).findById(id);
}

// Not wrapped in fastify-plugin — needs its own encapsulated context for `{ prefix: '/hiring' }`
// to apply, same reasoning as the other route-registering modules.
export default async function hiringModule(app: FastifyInstance): Promise<void> {
  const applicationRepository = new ApplicationRepository(app.mongo.db);
  await applicationRepository.createIndexes();

  const contractRepository = new ContractRepository(app.mongo.db);
  await contractRepository.createIndexes();

  const invitationRepository = new InvitationRepository(app.mongo.db);
  await invitationRepository.createIndexes();

  // Cross-module reads through each module's public surface (its index.ts), never its
  // repository/model directly — see CLAUDE.md's cross-module import rule.
  const listingRepository = new ListingRepository(app.mongo.db);
  const accountRepository = new AccountRepository(app.mongo.db);

  // Escrow needs real money movement, not just a read — hiring constructs its own WalletService
  // against the shared app.mongo.db/client, the same pattern payments/index.ts uses (and the
  // exact use case wallet/index.ts's createTransactionRunner comment calls out: "eventually
  // hiring for escrow payout"). The same transaction runner also backs hiring's own
  // applications+contracts atomic writes below — it's generic Mongo-session plumbing, not a
  // wallet-specific concern, so reusing one instance for both is simpler than writing a second
  // copy.
  const transactionRunner = createTransactionRunner(app);
  const walletService = new WalletService(
    new WalletRepository(app.mongo.db),
    new LedgerRepository(app.mongo.db),
    transactionRunner,
    app.audit,
  );

  const service = new HiringService(
    applicationRepository,
    contractRepository,
    invitationRepository,
    listingRepository,
    accountRepository,
    walletService,
    transactionRunner,
    app.audit,
    app.eventBus,
  );
  const controller = new HiringController(service);
  registerHiringRoutes(app, controller);
}
