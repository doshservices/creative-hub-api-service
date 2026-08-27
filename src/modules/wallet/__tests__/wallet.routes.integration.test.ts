import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app.js';
import type { AccountType } from '../../auth/model.js';
import { WalletRepository } from '../wallet.repository.js';
import { LedgerRepository } from '../ledger.repository.js';
import { WalletService } from '../service.js';
import { createTransactionRunner } from '../index.js';

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

function buildTestWalletService(app: FastifyInstance): WalletService {
  const wallets = new WalletRepository(app.mongo.db);
  const ledger = new LedgerRepository(app.mongo.db);
  return new WalletService(wallets, ledger, createTransactionRunner(app), app.audit);
}

describe('wallet routes', () => {
  let app: FastifyInstance;
  let walletService: WalletService;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
    walletService = buildTestWalletService(app);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await app.mongo.db.collection('accounts').deleteMany({});
    await app.mongo.db.collection('wallets').deleteMany({});
    await app.mongo.db.collection('ledgerEntries').deleteMany({});
  });

  describe('GET /wallet/me', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'GET', url: '/wallet/me' });
      expect(response.statusCode).toBe(401);
    });

    it('lazily creates a zero-balance wallet for a first-time account', async () => {
      const { token } = await registerAndGetToken(app, 'creative');

      const response = await app.inject({
        method: 'GET',
        url: '/wallet/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        currency: 'NGN',
        balanceMinor: 0,
        heldMinor: 0,
        availableMinor: 0,
      });
    });

    it('reflects credits and holds applied through the service', async () => {
      const { token, accountId } = await registerAndGetToken(app, 'creative');
      await walletService.credit(accountId, 'NGN', 10_000, { idempotencyKey: 'seed-1' });
      await walletService.hold(accountId, 'NGN', 4_000, { idempotencyKey: 'seed-2' });

      const response = await app.inject({
        method: 'GET',
        url: '/wallet/me',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.json().data).toMatchObject({
        balanceMinor: 10_000,
        heldMinor: 4_000,
        availableMinor: 6_000,
      });
    });

    it("never returns another account's wallet", async () => {
      const accountA = await registerAndGetToken(app, 'creative');
      const accountB = await registerAndGetToken(app, 'creative');
      await walletService.credit(accountA.accountId, 'NGN', 50_000, { idempotencyKey: 'a' });

      const response = await app.inject({
        method: 'GET',
        url: '/wallet/me',
        headers: { authorization: `Bearer ${accountB.token}` },
      });

      expect(response.json().data.balanceMinor).toBe(0);
    });
  });

  describe('GET /wallet/me/ledger', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'GET', url: '/wallet/me/ledger' });
      expect(response.statusCode).toBe(401);
    });

    it('returns an empty page for a wallet with no movements', async () => {
      const { token } = await registerAndGetToken(app, 'creative');

      const response = await app.inject({
        method: 'GET',
        url: '/wallet/me/ledger',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({ items: [], nextCursor: null });
    });

    it('paginates ledger entries newest first', async () => {
      const { token, accountId } = await registerAndGetToken(app, 'creative');
      for (let i = 0; i < 3; i += 1) {
        await walletService.credit(accountId, 'NGN', 1000, { idempotencyKey: `credit-${i}` });
      }

      const firstPage = await app.inject({
        method: 'GET',
        url: '/wallet/me/ledger?limit=2',
        headers: { authorization: `Bearer ${token}` },
      });
      const firstBody = firstPage.json().data;
      expect(firstBody.items).toHaveLength(2);
      expect(firstBody.nextCursor).toEqual(expect.any(String));

      const secondPage = await app.inject({
        method: 'GET',
        url: `/wallet/me/ledger?limit=2&cursor=${firstBody.nextCursor}`,
        headers: { authorization: `Bearer ${token}` },
      });
      const secondBody = secondPage.json().data;
      expect(secondBody.items).toHaveLength(1);
      expect(secondBody.nextCursor).toBeNull();
    });
  });
});
