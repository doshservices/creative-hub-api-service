import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app.js';
import type { AccountType } from '../../auth/model.js';
import { WalletRepository } from '../../wallet/wallet.repository.js';
import { LedgerRepository } from '../../wallet/ledger.repository.js';
import { WalletService } from '../../wallet/service.js';
import { createTransactionRunner } from '../../wallet/index.js';

function uniqueEmail(): string {
  return `test-${randomUUID()}@example.com`;
}

function buildTestWalletService(app: FastifyInstance): WalletService {
  const wallets = new WalletRepository(app.mongo.db);
  const ledger = new LedgerRepository(app.mongo.db);
  return new WalletService(wallets, ledger, createTransactionRunner(app), app.audit);
}

async function registerAndGetToken(
  app: FastifyInstance,
  accountType: AccountType,
): Promise<{ token: string; accountId: string; email: string }> {
  const email = uniqueEmail();
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email,
      password: 'password123',
      firstName: 'Dev',
      lastName: 'User',
      accountType,
    },
  });
  const token = response.json().data.accessToken as string;
  const payload = app.jwt.decode<{ sub: string }>(token);
  return { token, accountId: payload?.sub as string, email };
}

const minimalListing = {
  title: 'Dance Crew Needed',
  description: 'Looking for dancers.',
  location: 'Lagos, Nigeria',
  category: 'dance',
  projectType: 'onsite',
  paymentType: 'fixed',
  budgetMinMinor: 8_000_000,
  budgetMaxMinor: 10_000_000,
  currency: 'NGN',
  duration: '3 days',
};

async function createOpenListing(app: FastifyInstance, clientToken: string): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/listings',
    headers: { authorization: `Bearer ${clientToken}` },
    payload: minimalListing,
  });
  return response.json().data.id as string;
}

async function apply(app: FastifyInstance, creativeToken: string, listingId: string) {
  return app.inject({
    method: 'POST',
    url: '/hiring/applications',
    headers: { authorization: `Bearer ${creativeToken}` },
    payload: { listingId },
  });
}

interface CompletedContractParties {
  clientToken: string;
  clientAccountId: string;
  creativeToken: string;
  creativeAccountId: string;
  contractId: string;
}

// Mirrors hiring's own integration test setup: fund the client's wallet, create+apply+accept
// (funding escrow and creating an 'active' contract), then complete it — a review can only be
// submitted once status === 'completed'.
async function setupCompletedContract(
  app: FastifyInstance,
  walletService: WalletService,
): Promise<CompletedContractParties> {
  const client = await registerAndGetToken(app, 'client');
  const creative = await registerAndGetToken(app, 'creative');
  await walletService.credit(client.accountId, 'NGN', 20_000_000, {
    idempotencyKey: `test-fund-${client.accountId}`,
  });
  const listingId = await createOpenListing(app, client.token);
  const applyResponse = await apply(app, creative.token, listingId);
  const applicationId = applyResponse.json().data.id as string;

  await app.inject({
    method: 'PUT',
    url: `/hiring/applications/${applicationId}/status`,
    headers: { authorization: `Bearer ${client.token}` },
    payload: { status: 'accepted' },
  });
  const contract = await app.mongo.db
    .collection('contracts')
    .findOne({ applicationId: new ObjectId(applicationId) });
  if (!contract) {
    throw new Error('setupCompletedContract: expected a contract to have been created');
  }
  const contractId = contract._id.toHexString();

  const completeResponse = await app.inject({
    method: 'PUT',
    url: `/hiring/contracts/${contractId}/complete`,
    headers: { authorization: `Bearer ${client.token}` },
  });
  if (completeResponse.statusCode !== 200) {
    throw new Error(
      `setupCompletedContract: expected contract completion to succeed, got ${completeResponse.statusCode}`,
    );
  }

  return {
    clientToken: client.token,
    clientAccountId: client.accountId,
    creativeToken: creative.token,
    creativeAccountId: creative.accountId,
    contractId,
  };
}

async function submitReview(
  app: FastifyInstance,
  token: string,
  contractId: string,
  body: { rating: number; comment?: string },
) {
  return app.inject({
    method: 'POST',
    url: `/reviews/contracts/${contractId}/review`,
    headers: { authorization: `Bearer ${token}` },
    payload: body,
  });
}

describe('reviews routes', () => {
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
    await app.mongo.db.collection('listings').deleteMany({});
    await app.mongo.db.collection('applications').deleteMany({});
    await app.mongo.db.collection('contracts').deleteMany({});
    await app.mongo.db.collection('auditEntries').deleteMany({});
    await app.mongo.db.collection('wallets').deleteMany({});
    await app.mongo.db.collection('ledgerEntries').deleteMany({});
    await app.mongo.db.collection('reviews').deleteMany({});
    await app.mongo.db.collection('creativeProfiles').deleteMany({});
  });

  describe('POST /reviews/contracts/:id/review', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/reviews/contracts/000000000000000000000000/review',
        payload: { rating: 5 },
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects an account without reviews:submit', async () => {
      const { clientAccountId, contractId } = await setupCompletedContract(app, walletService);
      // Every account gets reviews:submit by default (see auth/service.ts's
      // defaultPermissionsFor) — requirePermission reads the permissions claim embedded in the
      // access token, so exercising "lacks the permission" means signing a fresh token with an
      // empty permissions claim for the same account, rather than mutating account state that a
      // token issued earlier wouldn't reflect anyway.
      const noPermissionToken = app.jwt.sign({ sub: clientAccountId, permissions: [] });

      const response = await submitReview(app, noPermissionToken, contractId, { rating: 5 });
      expect(response.statusCode).toBe(403);
    });

    it('rejects a contract that does not exist', async () => {
      const client = await registerAndGetToken(app, 'client');
      const response = await submitReview(app, client.token, '000000000000000000000000', {
        rating: 5,
      });
      expect(response.statusCode).toBe(404);
    });

    it('rejects a contract that is not completed', async () => {
      const client = await registerAndGetToken(app, 'client');
      const creative = await registerAndGetToken(app, 'creative');
      await walletService.credit(client.accountId, 'NGN', 20_000_000, {
        idempotencyKey: `test-fund-${client.accountId}`,
      });
      const listingId = await createOpenListing(app, client.token);
      const applyResponse = await apply(app, creative.token, listingId);
      await app.inject({
        method: 'PUT',
        url: `/hiring/applications/${applyResponse.json().data.id}/status`,
        headers: { authorization: `Bearer ${client.token}` },
        payload: { status: 'accepted' },
      });
      const contract = await app.mongo.db
        .collection('contracts')
        .findOne({ clientAccountId: new ObjectId(client.accountId) });
      const contractId = contract!._id.toHexString();

      const response = await submitReview(app, client.token, contractId, { rating: 5 });
      expect(response.statusCode).toBe(409);
    });

    it('rejects a caller who is not a party to the contract', async () => {
      const { contractId } = await setupCompletedContract(app, walletService);
      const outsider = await registerAndGetToken(app, 'client');

      const response = await submitReview(app, outsider.token, contractId, { rating: 5 });
      expect(response.statusCode).toBe(403);
    });

    it('creates a review and derives the reviewee as the other contract party', async () => {
      const { clientToken, creativeAccountId, contractId } = await setupCompletedContract(
        app,
        walletService,
      );

      const response = await submitReview(app, clientToken, contractId, {
        rating: 5,
        comment: 'Excellent work',
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data).toMatchObject({
        contractId,
        revieweeAccountId: creativeAccountId,
        rating: 5,
        comment: 'Excellent work',
      });
    });

    it('rejects a duplicate review from the same reviewer for the same contract', async () => {
      const { clientToken, contractId } = await setupCompletedContract(app, walletService);
      await submitReview(app, clientToken, contractId, { rating: 5 });

      const response = await submitReview(app, clientToken, contractId, { rating: 4 });
      expect(response.statusCode).toBe(409);
    });

    it('lets both parties review the same completed contract independently', async () => {
      const { clientToken, creativeToken, contractId } = await setupCompletedContract(
        app,
        walletService,
      );

      const clientReview = await submitReview(app, clientToken, contractId, { rating: 5 });
      const creativeReview = await submitReview(app, creativeToken, contractId, { rating: 4 });

      expect(clientReview.statusCode).toBe(201);
      expect(creativeReview.statusCode).toBe(201);
    });

    it('rejects an invalid rating', async () => {
      const { clientToken, contractId } = await setupCompletedContract(app, walletService);
      const response = await submitReview(app, clientToken, contractId, { rating: 6 });
      expect(response.statusCode).toBe(400);
    });

    it('end-to-end: submitting a review updates the creative profile rating aggregate', async () => {
      const { clientToken, creativeToken, creativeAccountId, contractId } =
        await setupCompletedContract(app, walletService);

      // The creative must have a profile for the public talent endpoint to return anything.
      await app.inject({
        method: 'PUT',
        url: '/users/me/creative-profile',
        headers: { authorization: `Bearer ${creativeToken}` },
        payload: { primaryRole: 'Dancer', skills: ['hip-hop'] },
      });

      const reviewResponse = await submitReview(app, clientToken, contractId, { rating: 4 });
      expect(reviewResponse.statusCode).toBe(201);

      // The rating-aggregate update happens asynchronously via the event bus — poll briefly
      // rather than asserting immediately after the response, same convention as hiring's
      // applicantCount event-bus test.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const profileResponse = await app.inject({
        method: 'GET',
        url: `/users/talents/${creativeAccountId}`,
        headers: { authorization: `Bearer ${clientToken}` },
      });
      expect(profileResponse.statusCode).toBe(200);
      expect(profileResponse.json().data).toMatchObject({ ratingAvg: 4, ratingCount: 1 });
    });
  });

  describe('GET /reviews/talents/:accountId/reviews', () => {
    it('returns an empty page when the talent has no reviews', async () => {
      const creative = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'GET',
        url: `/reviews/talents/${creative.accountId}/reviews`,
        headers: { authorization: `Bearer ${creative.token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({ items: [], nextCursor: null });
    });

    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/reviews/talents/000000000000000000000000/reviews',
      });
      expect(response.statusCode).toBe(401);
    });

    it('paginates reviews received by a talent, newest first', async () => {
      // Each completed contract belongs to a distinct client, so each client can independently
      // review the SAME creative without hitting the one-review-per-(contract,reviewer) index.
      const creative = await registerAndGetToken(app, 'creative');
      for (let i = 0; i < 3; i += 1) {
        const client = await registerAndGetToken(app, 'client');
        await walletService.credit(client.accountId, 'NGN', 20_000_000, {
          idempotencyKey: `test-fund-${client.accountId}`,
        });
        const listingId = await createOpenListing(app, client.token);
        const applyResponse = await apply(app, creative.token, listingId);
        await app.inject({
          method: 'PUT',
          url: `/hiring/applications/${applyResponse.json().data.id}/status`,
          headers: { authorization: `Bearer ${client.token}` },
          payload: { status: 'accepted' },
        });
        const contract = await app.mongo.db
          .collection('contracts')
          .findOne({ clientAccountId: new ObjectId(client.accountId) });
        const contractId = contract!._id.toHexString();
        await app.inject({
          method: 'PUT',
          url: `/hiring/contracts/${contractId}/complete`,
          headers: { authorization: `Bearer ${client.token}` },
        });
        await submitReview(app, client.token, contractId, { rating: 5 });
      }

      const firstPage = await app.inject({
        method: 'GET',
        url: `/reviews/talents/${creative.accountId}/reviews?limit=2`,
        headers: { authorization: `Bearer ${creative.token}` },
      });
      const firstBody = firstPage.json().data;
      expect(firstBody.items).toHaveLength(2);
      expect(firstBody.nextCursor).toEqual(expect.any(String));

      const secondPage = await app.inject({
        method: 'GET',
        url: `/reviews/talents/${creative.accountId}/reviews?limit=2&cursor=${firstBody.nextCursor}`,
        headers: { authorization: `Bearer ${creative.token}` },
      });
      const secondBody = secondPage.json().data;
      expect(secondBody.items).toHaveLength(1);
      expect(secondBody.nextCursor).toBeNull();
    });
  });
});
