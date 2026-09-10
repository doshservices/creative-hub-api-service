import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app.js';
import type { AccountType } from '../../auth/model.js';
import {
  WalletRepository,
  LedgerRepository,
  WalletService,
  createTransactionRunner,
} from '../../wallet/index.js';
import { DepositRepository } from '../deposit.repository.js';
import { WithdrawalRepository } from '../withdrawal.repository.js';
import { PaymentsService } from '../service.js';
import { processReconcileSweep, RECONCILE_STALE_THRESHOLD_MS } from '../queue.js';
import type { AccountReaderPort, ReconcileDispatchPort } from '../queue.js';
import type { FlutterwaveClientPort } from '../provider.js';

// The sweep never touches these ports itself (it only reads via `deposits`/`withdrawals` and
// dispatches via `reconcile`) — stand-ins so PaymentsWorkerDeps type-checks without pulling in
// the real HTTP client or account repository.
const unusedAccounts: AccountReaderPort = {
  findById: () => Promise.resolve(null),
};
const unusedFlutterwave: FlutterwaveClientPort = {
  initiatePayment: () => Promise.reject(new Error('not used in this test')),
  verifyTransaction: () => Promise.reject(new Error('not used in this test')),
  initiateTransfer: () => Promise.reject(new Error('not used in this test')),
  verifyTransfer: () => Promise.reject(new Error('not used in this test')),
};

function uniqueEmail(): string {
  return `test-${randomUUID()}@example.com`;
}

async function registerAndGetToken(app: FastifyInstance, accountType: AccountType) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email: uniqueEmail(),
      password: 'password123',
      firstName: 'Dev',
      lastName: 'User',
      accountType,
    },
  });
  const token = response.json().data.accessToken as string;
  const payload = app.jwt.decode<{ sub: string }>(token);
  return { token, accountId: payload?.sub as string };
}

function buildTestPaymentsService(app: FastifyInstance) {
  const deposits = new DepositRepository(app.mongo.db);
  const withdrawals = new WithdrawalRepository(app.mongo.db);
  const wallet = new WalletService(
    new WalletRepository(app.mongo.db),
    new LedgerRepository(app.mongo.db),
    createTransactionRunner(app),
    app.audit,
  );
  const noopQueue = {
    enqueueInitiateDeposit: async () => {},
    enqueueReconcileDeposit: async () => {},
    enqueueInitiateWithdrawal: async () => {},
    enqueueReconcileWithdrawal: async () => {},
  };
  const service = new PaymentsService(deposits, withdrawals, wallet, noopQueue, app.audit);
  return { service, deposits, withdrawals, wallet };
}

// Backdates a document's updatedAt directly in Mongo — the sweep's staleness query is driven by
// updatedAt (see DepositRepository.findStaleAwaitingPayment / WithdrawalRepository's analogue),
// and there's no way to backdate that through the normal API, same as the task's suggested
// approach of manipulating `createdAt` directly for this kind of test.
async function backdateUpdatedAt(
  app: FastifyInstance,
  collection: string,
  id: string,
  msAgo: number,
): Promise<void> {
  const { ObjectId } = await import('mongodb');
  await app.mongo.db
    .collection(collection)
    .updateOne({ _id: new ObjectId(id) }, { $set: { updatedAt: new Date(Date.now() - msAgo) } });
}

describe('payments reconciliation sweep', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await app.mongo.db.collection('accounts').deleteMany({});
    await app.mongo.db.collection('deposits').deleteMany({});
    await app.mongo.db.collection('withdrawals').deleteMany({});
    await app.mongo.db.collection('wallets').deleteMany({});
    await app.mongo.db.collection('ledgerEntries').deleteMany({});
    await app.mongo.db.collection('auditEntries').deleteMany({});
  });

  it('enqueues reconciliation for a deposit stuck in awaiting_payment past the stale threshold, and completes it once the (mocked) verify call reports success', async () => {
    const { accountId } = await registerAndGetToken(app, 'creative');
    const { service, deposits, wallet } = buildTestPaymentsService(app);

    const deposit = await service.initiateDeposit(accountId, { amountMinor: 5000 });
    // Simulate the initiate-deposit worker having gotten a checkout url (status -> awaiting_payment)
    // and a webhook having since arrived with a provider transaction id (persisted independent of
    // whether the reconcile-deposit job it enqueued alongside it ever completed).
    await deposits.setCheckoutUrl(deposit.id, 'https://checkout.flutterwave.com/x');
    await deposits.setProviderTransactionId(deposit.id, 'flw-tx-1');
    await backdateUpdatedAt(app, 'deposits', deposit.id, RECONCILE_STALE_THRESHOLD_MS + 60_000);

    const stale = await deposits.findStaleAwaitingPayment(
      new Date(Date.now() - RECONCILE_STALE_THRESHOLD_MS),
    );
    expect(stale).toEqual([{ id: deposit.id, providerTransactionId: 'flw-tx-1' }]);

    // Drive the sweep's dispatch logic directly (no real 10-minute wait, no real BullMQ
    // repeatable-job timer) — the reconcile dispatch is wired to immediately apply a
    // successful verification, standing in for what the real reconcile-deposit job would do
    // once it calls the (mocked, in this test) Flutterwave verifyTransaction and gets 'successful'.
    const reconcile: ReconcileDispatchPort = {
      enqueueReconcileDeposit: async (depositId, providerTransactionId) => {
        await service.applyDepositVerification(depositId, providerTransactionId, {
          status: 'successful',
          amountMinor: 5000,
          currency: 'NGN',
        });
      },
      enqueueReconcileWithdrawal: async () => {},
    };

    await processReconcileSweep(
      {},
      {
        deposits,
        withdrawals: new WithdrawalRepository(app.mongo.db),
        reconcile,
        accounts: unusedAccounts,
        flutterwave: unusedFlutterwave,
        service,
        depositRedirectUrl: 'https://example.com/payments/callback',
      },
    );

    const updated = await deposits.findById(deposit.id);
    expect(updated?.status).toBe('completed');

    const walletState = await wallet.getOrCreateWallet(accountId, 'NGN');
    expect(walletState.balanceMinor).toBe(5000);
  });

  it('does not select a deposit that never received a provider transaction id', async () => {
    const { accountId } = await registerAndGetToken(app, 'creative');
    const { service, deposits } = buildTestPaymentsService(app);

    const deposit = await service.initiateDeposit(accountId, { amountMinor: 5000 });
    await deposits.setCheckoutUrl(deposit.id, 'https://checkout.flutterwave.com/x');
    // No setProviderTransactionId call — this is the "never got a response from initiation"
    // case the sweep explicitly leaves alone (see queue.ts's processReconcileSweep comment).
    await backdateUpdatedAt(app, 'deposits', deposit.id, RECONCILE_STALE_THRESHOLD_MS + 60_000);

    const stale = await deposits.findStaleAwaitingPayment(
      new Date(Date.now() - RECONCILE_STALE_THRESHOLD_MS),
    );
    expect(stale).toEqual([]);
  });

  it('enqueues reconciliation for a withdrawal stuck in processing past the stale threshold, and completes it once the (mocked) verify call reports success', async () => {
    const { accountId } = await registerAndGetToken(app, 'creative');
    const { service, withdrawals, wallet } = buildTestPaymentsService(app);
    await wallet.credit(accountId, 'NGN', 10_000, { idempotencyKey: 'seed' });

    const withdrawal = await service.initiateWithdrawal(accountId, {
      amountMinor: 4000,
      bankCode: '044',
      accountNumber: '0123456789',
    });
    // markProcessing sets providerTransferId and status together, unlike the deposit flow.
    await withdrawals.markProcessing(withdrawal.id, 'flw-transfer-1');
    await backdateUpdatedAt(app, 'withdrawals', withdrawal.id, RECONCILE_STALE_THRESHOLD_MS + 60_000);

    const stale = await withdrawals.findStaleProcessing(
      new Date(Date.now() - RECONCILE_STALE_THRESHOLD_MS),
    );
    expect(stale).toEqual([{ id: withdrawal.id, providerTransferId: 'flw-transfer-1' }]);

    const reconcile: ReconcileDispatchPort = {
      enqueueReconcileDeposit: () => Promise.resolve(),
      enqueueReconcileWithdrawal: async (withdrawalId) => {
        await service.applyWithdrawalVerification(withdrawalId, { status: 'successful' });
      },
    };

    await processReconcileSweep(
      {},
      {
        deposits: new DepositRepository(app.mongo.db),
        withdrawals,
        reconcile,
        accounts: unusedAccounts,
        flutterwave: unusedFlutterwave,
        service,
        depositRedirectUrl: 'https://example.com/payments/callback',
      },
    );

    const updated = await withdrawals.findById(withdrawal.id);
    expect(updated?.status).toBe('completed');

    const walletState = await wallet.getOrCreateWallet(accountId, 'NGN');
    expect(walletState.balanceMinor).toBe(6000);
    expect(walletState.heldMinor).toBe(0);

    const auditEntries = await app.mongo.db
      .collection('auditEntries')
      .find({ action: 'payments.withdrawal_completed', targetId: withdrawal.id })
      .toArray();
    expect(auditEntries).toHaveLength(1);
  });

  it('does not select records that are still within the stale threshold', async () => {
    const { accountId } = await registerAndGetToken(app, 'creative');
    const { service, deposits } = buildTestPaymentsService(app);

    const deposit = await service.initiateDeposit(accountId, { amountMinor: 5000 });
    await deposits.setCheckoutUrl(deposit.id, 'https://checkout.flutterwave.com/x');
    await deposits.setProviderTransactionId(deposit.id, 'flw-tx-recent');
    // No backdating — updatedAt is "now", well inside the threshold.

    const stale = await deposits.findStaleAwaitingPayment(
      new Date(Date.now() - RECONCILE_STALE_THRESHOLD_MS),
    );
    expect(stale).toEqual([]);
  });
});
