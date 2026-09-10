import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app.js';
import { PERMISSIONS } from '../../../common/permissions.js';
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
): Promise<{ token: string; accountId: string }> {
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

// There's no self-service way to become an admin — a real operator grants this via rbac's
// role-assignment flow; directly setting permissions here stands in for that, same pattern as
// auth.routes.integration.test.ts's loginAsAdmin.
async function loginAsAdmin(app: FastifyInstance): Promise<string> {
  const adminEmail = uniqueEmail();
  await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email: adminEmail,
      password: 'password123',
      firstName: 'Admin',
      lastName: 'User',
      accountType: 'client',
    },
  });
  await app.mongo.db.collection('accounts').updateOne(
    { email: adminEmail },
    {
      $set: {
        permissions: [
          PERMISSIONS.ADMIN_USERS_MANAGE,
          PERMISSIONS.LISTINGS_MODERATE,
          PERMISSIONS.IDENTITY_REVIEW,
          PERMISSIONS.PAYMENTS_ADMIN,
          PERMISSIONS.WALLET_ADMIN,
          PERMISSIONS.AUDIT_READ,
        ],
      },
    },
  );
  const loginResponse = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: adminEmail, password: 'password123' },
  });
  return loginResponse.json().data.accessToken as string;
}

async function insertKycStatus(app: FastifyInstance, accountId: string, status: string) {
  const now = new Date();
  await app.mongo.db.collection('kycVerifications').insertOne({
    _id: new ObjectId(),
    accountId: new ObjectId(accountId),
    documentKey: `kyc-docs/${randomUUID()}.jpg`,
    documentType: 'national_id',
    documentCountry: 'NGA',
    status,
    providerReference: null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
  });
}

describe('admin routes', () => {
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
    await app.mongo.db.collection('creativeProfiles').deleteMany({});
    await app.mongo.db.collection('employerProfiles').deleteMany({});
    await app.mongo.db.collection('kycVerifications').deleteMany({});
    await app.mongo.db.collection('listings').deleteMany({});
    await app.mongo.db.collection('wallets').deleteMany({});
    await app.mongo.db.collection('ledgerEntries').deleteMany({});
    await app.mongo.db.collection('auditEntries').deleteMany({});
  });

  describe('GET /admin/talents', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'GET', url: '/admin/talents' });
      expect(response.statusCode).toBe(401);
    });

    it('rejects a caller without ADMIN_USERS_MANAGE', async () => {
      const creative = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'GET',
        url: '/admin/talents',
        headers: { authorization: `Bearer ${creative.token}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('strips a querystring field outside the schema rather than erroring — additionalProperties:false combined with Fastify\'s default removeAdditional ajv config, same as auth/schema.ts', async () => {
      const adminToken = await loginAsAdmin(app);
      const response = await app.inject({
        method: 'GET',
        url: '/admin/talents?unexpected=1',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
    });

    it('stitches profile, KYC status, and wallet balance for one account, and returns null for another that has none of them', async () => {
      const adminToken = await loginAsAdmin(app);

      const withEverything = await registerAndGetToken(app, 'creative');
      await app.inject({
        method: 'PUT',
        url: '/users/me/creative-profile',
        headers: { authorization: `Bearer ${withEverything.token}` },
        payload: { primaryRole: 'Photographer', skills: ['portrait'] },
      });
      await insertKycStatus(app, withEverything.accountId, 'approved');
      await walletService.credit(withEverything.accountId, 'NGN', 15_000, {
        idempotencyKey: `admin-test-${withEverything.accountId}`,
      });

      const bareAccount = await registerAndGetToken(app, 'creative');

      const response = await app.inject({
        method: 'GET',
        url: '/admin/talents?limit=50',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const items = response.json().data.items as Array<Record<string, unknown>>;

      const fullRow = items.find((item) => item.accountId === withEverything.accountId);
      expect(fullRow).toMatchObject({
        accountId: withEverything.accountId,
        accountType: 'creative',
        status: 'active',
        kycStatus: 'approved',
        wallet: { balanceMinor: 15_000, heldMinor: 0, currency: 'NGN' },
      });
      expect(fullRow?.profile).toMatchObject({ primaryRole: 'Photographer' });

      const bareRow = items.find((item) => item.accountId === bareAccount.accountId);
      expect(bareRow).toMatchObject({
        accountId: bareAccount.accountId,
        profile: null,
        kycStatus: null,
        wallet: null,
      });
    });

    it('does not include client accounts in the talents list', async () => {
      const adminToken = await loginAsAdmin(app);
      const client = await registerAndGetToken(app, 'client');

      const response = await app.inject({
        method: 'GET',
        url: '/admin/talents?limit=50',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const items = response.json().data.items as Array<Record<string, unknown>>;
      expect(items.some((item) => item.accountId === client.accountId)).toBe(false);
    });

    it('paginates: a full first page returns a nextCursor, the following page eventually ends with null', async () => {
      const adminToken = await loginAsAdmin(app);
      for (let i = 0; i < 3; i += 1) {
        await registerAndGetToken(app, 'creative');
      }

      const firstPage = await app.inject({
        method: 'GET',
        url: '/admin/talents?limit=2',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const firstBody = firstPage.json().data;
      expect(firstBody.items).toHaveLength(2);
      expect(firstBody.nextCursor).toEqual(expect.any(String));

      const secondPage = await app.inject({
        method: 'GET',
        url: `/admin/talents?limit=2&cursor=${firstBody.nextCursor}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const secondBody = secondPage.json().data;
      expect(secondBody.items).toHaveLength(1);
      expect(secondBody.nextCursor).toBeNull();
    });

    it('returns an empty page when there are no creative accounts', async () => {
      const adminToken = await loginAsAdmin(app);
      const response = await app.inject({
        method: 'GET',
        url: '/admin/talents',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({ items: [], nextCursor: null });
    });
  });

  describe('GET /admin/employers', () => {
    it('rejects a caller without ADMIN_USERS_MANAGE', async () => {
      const client = await registerAndGetToken(app, 'client');
      const response = await app.inject({
        method: 'GET',
        url: '/admin/employers',
        headers: { authorization: `Bearer ${client.token}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('stitches an employer profile when present and returns null when absent', async () => {
      const adminToken = await loginAsAdmin(app);

      const withProfile = await registerAndGetToken(app, 'client');
      await app.inject({
        method: 'PUT',
        url: '/users/me/employer-profile',
        headers: { authorization: `Bearer ${withProfile.token}` },
        payload: { companyName: 'Acme Studios' },
      });

      const bareAccount = await registerAndGetToken(app, 'client');

      const response = await app.inject({
        method: 'GET',
        url: '/admin/employers?limit=50',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const items = response.json().data.items as Array<Record<string, unknown>>;

      const fullRow = items.find((item) => item.accountId === withProfile.accountId);
      expect(fullRow?.profile).toMatchObject({ companyName: 'Acme Studios' });

      const bareRow = items.find((item) => item.accountId === bareAccount.accountId);
      expect(bareRow).toMatchObject({ profile: null, kycStatus: null, wallet: null });
    });

    it('does not include creative accounts in the employers list', async () => {
      const adminToken = await loginAsAdmin(app);
      const creative = await registerAndGetToken(app, 'creative');

      const response = await app.inject({
        method: 'GET',
        url: '/admin/employers?limit=50',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const items = response.json().data.items as Array<Record<string, unknown>>;
      expect(items.some((item) => item.accountId === creative.accountId)).toBe(false);
    });
  });

  describe('GET /admin/stats', () => {
    it('rejects a caller without ADMIN_USERS_MANAGE', async () => {
      const creative = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'GET',
        url: '/admin/stats',
        headers: { authorization: `Bearer ${creative.token}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('reports total talents/employers and platform listing stats', async () => {
      const adminToken = await loginAsAdmin(app);
      const client = await registerAndGetToken(app, 'client');
      await registerAndGetToken(app, 'creative');
      await registerAndGetToken(app, 'creative');

      await app.inject({
        method: 'POST',
        url: '/listings',
        headers: { authorization: `Bearer ${client.token}` },
        payload: {
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
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/admin/stats',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json().data;
      // >= rather than exact equality: loginAsAdmin registers its own client account, and this
      // file's tests run with fileParallelism disabled but share the suite's afterEach cleanup
      // boundary, not a per-test one.
      expect(data.totalTalents).toBeGreaterThanOrEqual(2);
      expect(data.totalEmployers).toBeGreaterThanOrEqual(2);
      expect(data.activeListings).toBeGreaterThanOrEqual(1);
      expect(data.listingsByCategory.dance).toBeGreaterThanOrEqual(1);
    });
  });
});
