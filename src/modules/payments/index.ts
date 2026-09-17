import { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { AccountRepository } from '../auth/index.js';
import {
  WalletRepository,
  LedgerRepository,
  WalletService,
  createTransactionRunner,
} from '../wallet/index.js';
import { DepositRepository } from './deposit.repository.js';
import { WithdrawalRepository } from './withdrawal.repository.js';
import { HttpFlutterwaveClient } from './provider.js';
import { createPaymentsQueue, createPaymentsWorker, RECONCILE_SWEEP_INTERVAL_MS } from './queue.js';
import { PaymentsService, type PaymentsQueuePort } from './service.js';
import { PaymentsController } from './controller.js';
import { registerPaymentsRoutes } from './routes.js';

// Not wrapped in fastify-plugin — needs its own encapsulated context for `{ prefix: '/payments' }`
// to apply, same reasoning as the other route-registering modules.
export default async function paymentsModule(app: FastifyInstance): Promise<void> {
  const depositRepository = new DepositRepository(app.mongo.db);
  await depositRepository.createIndexes();

  const withdrawalRepository = new WithdrawalRepository(app.mongo.db);
  await withdrawalRepository.createIndexes();

  // Cross-module reads through each module's public surface (its index.ts) — never another
  // module's model/collection directly. Payments constructs its own WalletService the same way
  // hiring constructs its own ListingRepository, against the shared app.mongo.db/client.
  const accountRepository = new AccountRepository(app.mongo.db);
  const walletService = new WalletService(
    new WalletRepository(app.mongo.db),
    new LedgerRepository(app.mongo.db),
    createTransactionRunner(app),
    app.audit,
  );

  // BullMQ requires maxRetriesPerRequest disabled on its Redis connections — app.redis is
  // configured for the app's own cache/session use, so this module brings its own connections
  // rather than repurposing that one (same reasoning as identity/index.ts).
  const queueConnection = new Redis(app.config.redis.url, { maxRetriesPerRequest: null });
  const workerConnection = new Redis(app.config.redis.url, { maxRetriesPerRequest: null });

  const queue = createPaymentsQueue(queueConnection, {
    attempts: app.config.paymentsJob.attempts,
    backoffMs: app.config.paymentsJob.backoffMs,
  });

  const flutterwaveClient = new HttpFlutterwaveClient(
    app.config.flutterwave.apiUrl,
    app.config.flutterwave.secretKey,
  );

  const queuePort: PaymentsQueuePort = {
    async enqueueInitiateDeposit(depositId) {
      await queue.add('initiate-deposit', { depositId });
    },
    async enqueueReconcileDeposit(depositId, providerTransactionId) {
      await queue.add('reconcile-deposit', { depositId, providerTransactionId });
    },
    async enqueueInitiateWithdrawal(withdrawalId) {
      await queue.add('initiate-withdrawal', { withdrawalId });
    },
    async enqueueReconcileWithdrawal(withdrawalId, providerTransferId) {
      await queue.add('reconcile-withdrawal', { withdrawalId, providerTransferId });
    },
  };

  const service = new PaymentsService(
    depositRepository,
    withdrawalRepository,
    walletService,
    queuePort,
    app.audit,
  );

  // Flutterwave's hosted checkout redirects the customer's browser back here once they finish
  // paying — the frontend origin is the same one CORS already trusts, so it's reused rather
  // than adding a second "public URL" config knob for the same value.
  const depositRedirectUrl = `${app.config.cors.origin}/payments/callback`;

  const worker = createPaymentsWorker(workerConnection, {
    deposits: depositRepository,
    withdrawals: withdrawalRepository,
    accounts: accountRepository,
    flutterwave: flutterwaveClient,
    service,
    // The sweep dispatches into the same reconcile-deposit/reconcile-withdrawal jobs the webhook
    // path enqueues — reusing queuePort rather than a second queue connection (see queue.ts).
    reconcile: queuePort,
    depositRedirectUrl,
  });

  // Reconciliation safety net (money-and-ledger skill: "a reconciliation job... is a first-class
  // scheduled job, not an afterthought"). Registered as a BullMQ job scheduler — idempotent on
  // `jobSchedulerId`, so re-running this on every app boot updates the existing schedule instead
  // of creating a duplicate repeatable job (queue.add's old `repeat` option is no longer valid in
  // the installed BullMQ version; upsertJobScheduler is the current, non-deprecated mechanism).
  // What this DOES and does NOT cover is spelled out in queue.ts, next to processReconcileSweep —
  // in short: it re-verifies deposits/withdrawals already stuck in a non-terminal state with a
  // known provider id (a missed-webhook safety net), and explicitly does NOT fix records that
  // never obtained a provider id in the first place (those failed at initiation, a separate,
  // unrelated concern from what this job can address).
  await queue.upsertJobScheduler(
    'reconcile-sweep',
    { every: RECONCILE_SWEEP_INTERVAL_MS },
    { name: 'reconcile-sweep', data: {} },
  );

  // Only land a record in 'failed' once every retry is exhausted — earlier attempts just retry
  // per the queue's backoff, per the third-party-provider skill. The withdrawal path also
  // releases the wallet hold on exhaustion so funds don't stay reserved forever.
  worker.on('failed', (job, error) => {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < attempts) return;

    // Logged here regardless of outcome below — this is the only place an exhausted-retries
    // failure is otherwise visible at all; without it, a failed deposit/withdrawal produces no
    // server-log trace whatsoever, only a row in Mongo (see provider.ts's extractErrorMessage
    // comment for the bug this masked: a withdrawal landed with failureReason: null and no way
    // to tell why from the logs).
    app.log.error({ jobName: job.name, jobId: job.id, err: error }, 'payments job exhausted retries');

    switch (job.name) {
      case 'initiate-deposit':
      case 'reconcile-deposit': {
        const { depositId } = job.data as { depositId: string };
        service.failDepositWithReason(depositId, error.message).catch((cause: unknown) => {
          app.log.error({ depositId, err: cause }, 'failed to record deposit failure');
        });
        break;
      }
      case 'initiate-withdrawal':
      case 'reconcile-withdrawal': {
        const { withdrawalId } = job.data as { withdrawalId: string };
        service.failWithdrawalAndReleaseHold(withdrawalId, error.message).catch((cause: unknown) => {
          app.log.error({ withdrawalId, err: cause }, 'failed to record withdrawal failure and release hold');
        });
        break;
      }
    }
  });

  const controller = new PaymentsController(service);
  registerPaymentsRoutes(app, controller, app.config.flutterwave.webhookSecretHash);

  app.addHook('onClose', async () => {
    await worker.close();
    await queue.close();
    await queueConnection.quit();
    await workerConnection.quit();
  });
}
