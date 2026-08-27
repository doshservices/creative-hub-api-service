import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app.js';
import type { AccountType } from '../../auth/model.js';
import { WalletRepository, LedgerRepository, WalletService, createTransactionRunner } from '../../wallet/index.js';
import { DepositRepository } from '../deposit.repository.js';
import { WithdrawalRepository } from '../withdrawal.repository.js';
import { PaymentsService } from '../service.js';

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

async function waitForDepositStatus(
  app: FastifyInstance,
  token: string,
  depositId: string,
  status: string,
  timeoutMs = 15000,
): Promise<{ statusCode: number; body: { status: string } }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await app.inject({
      method: 'GET',
      url: `/payments/deposits/${depositId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    const body = response.json().data;
    if (body.status === status || Date.now() > deadline) {
      return { statusCode: response.statusCode, body };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
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

describe('payments routes', () => {
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

  describe('POST /payments/deposits', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/payments/deposits',
        payload: { amountMinor: 5000 },
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects an invalid amount', async () => {
      const { token } = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'POST',
        url: '/payments/deposits',
        headers: { authorization: `Bearer ${token}` },
        payload: { amountMinor: 0 },
      });
      expect(response.statusCode).toBe(400);
    });

    it('creates a pending deposit', async () => {
      const { token } = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'POST',
        url: '/payments/deposits',
        headers: { authorization: `Bearer ${token}` },
        payload: { amountMinor: 5000 },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data).toMatchObject({ status: 'pending', amountMinor: 5000, currency: 'NGN' });
    });

    it('moves to failed once the (unreachable, in this test env) Flutterwave call exhausts retries', async () => {
      const { token } = await registerAndGetToken(app, 'creative');
      const createResponse = await app.inject({
        method: 'POST',
        url: '/payments/deposits',
        headers: { authorization: `Bearer ${token}` },
        payload: { amountMinor: 5000 },
      });
      const depositId = createResponse.json().data.id as string;

      const { statusCode, body } = await waitForDepositStatus(app, token, depositId, 'failed', 15000);
      expect(statusCode).toBe(200);
      expect(body.status).toBe('failed');
    }, 20000);
  });

  describe('GET /payments/deposits/:id', () => {
    it("returns 403 for another account's deposit", async () => {
      const owner = await registerAndGetToken(app, 'creative');
      const other = await registerAndGetToken(app, 'creative');
      const createResponse = await app.inject({
        method: 'POST',
        url: '/payments/deposits',
        headers: { authorization: `Bearer ${owner.token}` },
        payload: { amountMinor: 5000 },
      });
      const depositId = createResponse.json().data.id as string;

      const response = await app.inject({
        method: 'GET',
        url: `/payments/deposits/${depositId}`,
        headers: { authorization: `Bearer ${other.token}` },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /payments/deposits', () => {
    it('paginates the account own deposits', async () => {
      const { token } = await registerAndGetToken(app, 'creative');
      for (let i = 0; i < 3; i += 1) {
        await app.inject({
          method: 'POST',
          url: '/payments/deposits',
          headers: { authorization: `Bearer ${token}` },
          payload: { amountMinor: 1000 },
        });
      }

      const firstPage = await app.inject({
        method: 'GET',
        url: '/payments/deposits?limit=2',
        headers: { authorization: `Bearer ${token}` },
      });
      const firstBody = firstPage.json().data;
      expect(firstBody.items).toHaveLength(2);
      expect(firstBody.nextCursor).toEqual(expect.any(String));

      const secondPage = await app.inject({
        method: 'GET',
        url: `/payments/deposits?limit=2&cursor=${firstBody.nextCursor}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(secondPage.json().data.items).toHaveLength(1);
    });
  });

  describe('POST /payments/withdrawals', () => {
    it('rejects a withdrawal larger than the available wallet balance', async () => {
      const { token } = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'POST',
        url: '/payments/withdrawals',
        headers: { authorization: `Bearer ${token}` },
        payload: { amountMinor: 5000, bankCode: '044', accountNumber: '0123456789' },
      });
      expect(response.statusCode).toBe(409);
    });

    it('places a hold and creates a pending withdrawal when funds are available', async () => {
      const { token, accountId } = await registerAndGetToken(app, 'creative');
      const { wallet } = buildTestPaymentsService(app);
      await wallet.credit(accountId, 'NGN', 10_000, { idempotencyKey: 'seed' });

      const response = await app.inject({
        method: 'POST',
        url: '/payments/withdrawals',
        headers: { authorization: `Bearer ${token}` },
        payload: { amountMinor: 4000, bankCode: '044', accountNumber: '0123456789' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data).toMatchObject({ status: 'pending', amountMinor: 4000 });

      const walletState = await wallet.getOrCreateWallet(accountId, 'NGN');
      expect(walletState.heldMinor).toBe(4000);
      expect(walletState.availableMinor).toBe(6000);
    });
  });

  describe('withdrawal result application (worker path)', () => {
    it('a successful verification captures the hold and completes the withdrawal', async () => {
      const { accountId } = await registerAndGetToken(app, 'creative');
      const { service, wallet, withdrawals } = buildTestPaymentsService(app);
      await wallet.credit(accountId, 'NGN', 10_000, { idempotencyKey: 'seed' });

      const withdrawal = await service.initiateWithdrawal(accountId, {
        amountMinor: 4000,
        bankCode: '044',
        accountNumber: '0123456789',
      });

      await service.applyWithdrawalVerification(withdrawal.id, { status: 'successful' });

      const updated = await withdrawals.findById(withdrawal.id);
      expect(updated?.status).toBe('completed');

      const walletState = await wallet.getOrCreateWallet(accountId, 'NGN');
      expect(walletState.balanceMinor).toBe(6000);
      expect(walletState.heldMinor).toBe(0);

      const auditEntries = await app.mongo.db
        .collection('auditEntries')
        .find({ action: 'payments.withdrawal_completed' })
        .toArray();
      expect(auditEntries).toHaveLength(1);
    });

    it('a failed verification releases the hold back to available balance', async () => {
      const { accountId } = await registerAndGetToken(app, 'creative');
      const { service, wallet, withdrawals } = buildTestPaymentsService(app);
      await wallet.credit(accountId, 'NGN', 10_000, { idempotencyKey: 'seed' });

      const withdrawal = await service.initiateWithdrawal(accountId, {
        amountMinor: 4000,
        bankCode: '044',
        accountNumber: '0123456789',
      });

      await service.applyWithdrawalVerification(withdrawal.id, { status: 'failed' });

      const updated = await withdrawals.findById(withdrawal.id);
      expect(updated?.status).toBe('failed');

      const walletState = await wallet.getOrCreateWallet(accountId, 'NGN');
      expect(walletState.balanceMinor).toBe(10_000);
      expect(walletState.heldMinor).toBe(0);
      expect(walletState.availableMinor).toBe(10_000);
    });
  });

  describe('POST /payments/webhooks/flutterwave', () => {
    it('rejects a request with a missing or invalid verif-hash header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/payments/webhooks/flutterwave',
        headers: { 'verif-hash': 'wrong-secret' },
        payload: { event: 'charge.completed', data: { id: 1, tx_ref: 'dep_x' } },
      });
      expect(response.statusCode).toBe(403);
    });

    it('acknowledges a validly-signed event even when no matching deposit exists', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/payments/webhooks/flutterwave',
        headers: { 'verif-hash': 'dev-webhook-secret' },
        payload: { event: 'charge.completed', data: { id: 1, tx_ref: 'unknown-ref' } },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ success: true });
    });
  });
});
