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

describe('hiring routes', () => {
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
    await app.mongo.db.collection('invitations').deleteMany({});
    await app.mongo.db.collection('auditEntries').deleteMany({});
    await app.mongo.db.collection('wallets').deleteMany({});
    await app.mongo.db.collection('ledgerEntries').deleteMany({});
  });

  describe('POST /hiring/applications', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/hiring/applications',
        payload: { listingId: '000000000000000000000000' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects a client account (lacks hiring:apply)', async () => {
      const client = await registerAndGetToken(app, 'client');
      const listingId = await createOpenListing(app, client.token);

      const response = await apply(app, client.token, listingId);

      expect(response.statusCode).toBe(403);
    });

    it('rejects applying to a listing that does not exist', async () => {
      const creative = await registerAndGetToken(app, 'creative');
      const response = await apply(app, creative.token, '000000000000000000000000');
      expect(response.statusCode).toBe(404);
    });

    it('rejects applying to a closed listing', async () => {
      const client = await registerAndGetToken(app, 'client');
      const creative = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, client.token);
      await app.inject({
        method: 'POST',
        url: `/listings/${listingId}/close`,
        headers: { authorization: `Bearer ${client.token}` },
      });

      const response = await apply(app, creative.token, listingId);
      expect(response.statusCode).toBe(409);
    });

    it('creates an application for a creative account', async () => {
      const client = await registerAndGetToken(app, 'client');
      const creative = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, client.token);

      const response = await apply(app, creative.token, listingId);

      expect(response.statusCode).toBe(201);
      expect(response.json().data).toMatchObject({ listingId, status: 'pending' });
    });

    it('rejects a duplicate application to the same listing', async () => {
      const client = await registerAndGetToken(app, 'client');
      const creative = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, client.token);

      await apply(app, creative.token, listingId);
      const response = await apply(app, creative.token, listingId);

      expect(response.statusCode).toBe(409);
    });
  });

  describe('GET /hiring/applications/mine', () => {
    it('returns an empty page when the creative has not applied to anything', async () => {
      const creative = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'GET',
        url: '/hiring/applications/mine',
        headers: { authorization: `Bearer ${creative.token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({ items: [], nextCursor: null });
    });

    it("paginates the creative's own applications", async () => {
      const client = await registerAndGetToken(app, 'client');
      const creative = await registerAndGetToken(app, 'creative');
      for (let i = 0; i < 3; i += 1) {
        const listingId = await createOpenListing(app, client.token);
        await apply(app, creative.token, listingId);
      }

      const firstPage = await app.inject({
        method: 'GET',
        url: '/hiring/applications/mine?limit=2',
        headers: { authorization: `Bearer ${creative.token}` },
      });
      const firstBody = firstPage.json().data;
      expect(firstBody.items).toHaveLength(2);
      expect(firstBody.nextCursor).toEqual(expect.any(String));

      const secondPage = await app.inject({
        method: 'GET',
        url: `/hiring/applications/mine?limit=2&cursor=${firstBody.nextCursor}`,
        headers: { authorization: `Bearer ${creative.token}` },
      });
      const secondBody = secondPage.json().data;
      expect(secondBody.items).toHaveLength(1);
      expect(secondBody.nextCursor).toBeNull();
    });
  });

  describe('GET /hiring/listings/:listingId/applications', () => {
    it('rejects a client who does not own the listing', async () => {
      const owner = await registerAndGetToken(app, 'client');
      const otherClient = await registerAndGetToken(app, 'client');
      const creative = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, owner.token);
      await apply(app, creative.token, listingId);

      const response = await app.inject({
        method: 'GET',
        url: `/hiring/listings/${listingId}/applications`,
        headers: { authorization: `Bearer ${otherClient.token}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('returns applications for the owning client', async () => {
      const owner = await registerAndGetToken(app, 'client');
      const creative = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, owner.token);
      await apply(app, creative.token, listingId);

      const response = await app.inject({
        method: 'GET',
        url: `/hiring/listings/${listingId}/applications`,
        headers: { authorization: `Bearer ${owner.token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.items).toHaveLength(1);
    });
  });

  describe('PUT /hiring/applications/:id/status', () => {
    async function setupApplication(app: FastifyInstance) {
      const client = await registerAndGetToken(app, 'client');
      const creative = await registerAndGetToken(app, 'creative');
      // Escrow is funded (a wallet hold) the moment a client accepts an application, so the
      // client's wallet needs a real balance before that transition — see
      // HiringService.persistContractWithEscrow.
      await walletService.credit(client.accountId, 'NGN', 20_000_000, {
        idempotencyKey: `test-fund-${client.accountId}`,
      });
      const listingId = await createOpenListing(app, client.token);
      const applyResponse = await apply(app, creative.token, listingId);
      return {
        clientToken: client.token,
        clientAccountId: client.accountId,
        creativeToken: creative.token,
        creativeAccountId: creative.accountId,
        applicationId: applyResponse.json().data.id as string,
      };
    }

    it('rejects a client who does not own the application', async () => {
      const { applicationId } = await setupApplication(app);
      const otherClient = await registerAndGetToken(app, 'client');

      const response = await app.inject({
        method: 'PUT',
        url: `/hiring/applications/${applicationId}/status`,
        headers: { authorization: `Bearer ${otherClient.token}` },
        payload: { status: 'accepted' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('accepting an application funds escrow and creates a contract with an audit entry', async () => {
      const { clientToken, creativeToken, applicationId } = await setupApplication(app);

      const response = await app.inject({
        method: 'PUT',
        url: `/hiring/applications/${applicationId}/status`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: { status: 'accepted' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.status).toBe('accepted');

      const contract = await app.mongo.db
        .collection('contracts')
        .findOne({ applicationId: new ObjectId(applicationId) });
      expect(contract).not.toBeNull();
      expect(contract?.status).toBe('active');
      expect(contract?.escrowHoldEntryId).not.toBeNull();

      const holdEntry = await app.mongo.db
        .collection('ledgerEntries')
        .findOne({ _id: contract?.escrowHoldEntryId });
      expect(holdEntry).toMatchObject({ type: 'hold', amountMinor: 10_000_000 });

      const auditEntries = await app.mongo.db
        .collection('auditEntries')
        .find({ action: 'hiring.contract_created' })
        .toArray();
      expect(auditEntries).toHaveLength(1);

      const contractsResponse = await app.inject({
        method: 'GET',
        url: '/hiring/contracts/mine',
        headers: { authorization: `Bearer ${creativeToken}` },
      });
      expect(contractsResponse.json().data.items).toHaveLength(1);
    });

    it('rejects accepting an application when the client cannot fund escrow', async () => {
      const client = await registerAndGetToken(app, 'client');
      const creative = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, client.token);
      const applyResponse = await apply(app, creative.token, listingId);
      const applicationId = applyResponse.json().data.id as string;

      const response = await app.inject({
        method: 'PUT',
        url: `/hiring/applications/${applicationId}/status`,
        headers: { authorization: `Bearer ${client.token}` },
        payload: { status: 'accepted' },
      });

      expect(response.statusCode).toBe(409);

      const applicationResponse = await app.inject({
        method: 'GET',
        url: '/hiring/applications/mine',
        headers: { authorization: `Bearer ${creative.token}` },
      });
      expect(applicationResponse.json().data.items[0].status).toBe('pending');
    });

    it('rejects updating an application that already reached a final decision', async () => {
      const { clientToken, applicationId } = await setupApplication(app);
      await app.inject({
        method: 'PUT',
        url: `/hiring/applications/${applicationId}/status`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: { status: 'rejected' },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/hiring/applications/${applicationId}/status`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: { status: 'accepted' },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('PUT /hiring/applications/:id/withdraw', () => {
    it('rejects a creative who does not own the application', async () => {
      const client = await registerAndGetToken(app, 'client');
      const creative = await registerAndGetToken(app, 'creative');
      const otherCreative = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, client.token);
      const applyResponse = await apply(app, creative.token, listingId);

      const response = await app.inject({
        method: 'PUT',
        url: `/hiring/applications/${applyResponse.json().data.id}/withdraw`,
        headers: { authorization: `Bearer ${otherCreative.token}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('withdraws a pending application and decrements the listing applicant count', async () => {
      const client = await registerAndGetToken(app, 'client');
      const creative = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, client.token);
      const applyResponse = await apply(app, creative.token, listingId);

      const response = await app.inject({
        method: 'PUT',
        url: `/hiring/applications/${applyResponse.json().data.id}/withdraw`,
        headers: { authorization: `Bearer ${creative.token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.status).toBe('withdrawn');

      // The applicantCount decrement happens asynchronously via the event bus — poll briefly
      // rather than asserting immediately after the response.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const listing = await app.mongo.db
        .collection('listings')
        .findOne({ _id: new ObjectId(listingId) });
      expect(listing?.applicantCount).toBe(0);
    });
  });

  describe('GET /hiring/contracts/mine', () => {
    it('returns an empty page when there are no contracts', async () => {
      const client = await registerAndGetToken(app, 'client');
      const response = await app.inject({
        method: 'GET',
        url: '/hiring/contracts/mine',
        headers: { authorization: `Bearer ${client.token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({ items: [], nextCursor: null });
    });

    it('returns the contract for both the client and the creative side', async () => {
      const { clientToken, creativeToken } = await setupAcceptedContract(app, walletService);

      const clientView = await app.inject({
        method: 'GET',
        url: '/hiring/contracts/mine',
        headers: { authorization: `Bearer ${clientToken}` },
      });
      const creativeView = await app.inject({
        method: 'GET',
        url: '/hiring/contracts/mine',
        headers: { authorization: `Bearer ${creativeToken}` },
      });

      expect(clientView.json().data.items).toHaveLength(1);
      expect(creativeView.json().data.items).toHaveLength(1);
      expect(clientView.json().data.items[0].id).toBe(creativeView.json().data.items[0].id);
    });
  });

  describe('PUT /hiring/contracts/:id/complete', () => {
    it('rejects a client who does not own the contract', async () => {
      const { contractId } = await setupAcceptedContract(app, walletService);
      const otherClient = await registerAndGetToken(app, 'client');

      const response = await app.inject({
        method: 'PUT',
        url: `/hiring/contracts/${contractId}/complete`,
        headers: { authorization: `Bearer ${otherClient.token}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('completes the contract and credits the escrowed amount to the creative', async () => {
      const { clientToken, creativeAccountId, contractId } = await setupAcceptedContract(
        app,
        walletService,
      );

      const response = await app.inject({
        method: 'PUT',
        url: `/hiring/contracts/${contractId}/complete`,
        headers: { authorization: `Bearer ${clientToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.status).toBe('completed');

      const creativeWallet = await app.mongo.db
        .collection('wallets')
        .findOne({ accountId: new ObjectId(creativeAccountId) });
      expect(creativeWallet?.balanceMinor).toBe(10_000_000);

      const auditEntries = await app.mongo.db
        .collection('auditEntries')
        .find({ action: 'hiring.contract_completed' })
        .toArray();
      expect(auditEntries).toHaveLength(1);
    });

    it('rejects completing a contract that is not active', async () => {
      const { clientToken, contractId } = await setupAcceptedContract(app, walletService);
      await app.inject({
        method: 'PUT',
        url: `/hiring/contracts/${contractId}/complete`,
        headers: { authorization: `Bearer ${clientToken}` },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/hiring/contracts/${contractId}/complete`,
        headers: { authorization: `Bearer ${clientToken}` },
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('talent invitations', () => {
    it('lets an employer invite a talent, who can then accept it into a funded contract', async () => {
      const client = await registerAndGetToken(app, 'client');
      const creative = await registerAndGetToken(app, 'creative');
      await walletService.credit(client.accountId, 'NGN', 20_000_000, {
        idempotencyKey: `test-fund-${client.accountId}`,
      });
      const listingId = await createOpenListing(app, client.token);

      const inviteResponse = await app.inject({
        method: 'POST',
        url: `/hiring/listings/${listingId}/invitations`,
        headers: { authorization: `Bearer ${client.token}` },
        payload: { creativeAccountId: creative.accountId },
      });
      expect(inviteResponse.statusCode).toBe(201);
      const invitationId = inviteResponse.json().data.id as string;

      const acceptResponse = await app.inject({
        method: 'PUT',
        url: `/hiring/invitations/${invitationId}/accept`,
        headers: { authorization: `Bearer ${creative.token}` },
      });
      expect(acceptResponse.statusCode).toBe(200);
      expect(acceptResponse.json().data.status).toBe('accepted');

      const contract = await app.mongo.db
        .collection('contracts')
        .findOne({ applicationId: new ObjectId(acceptResponse.json().data.id as string) });
      expect(contract).not.toBeNull();
      expect(contract?.status).toBe('active');
    });

    it('rejects an employer inviting a non-creative account', async () => {
      const client = await registerAndGetToken(app, 'client');
      const otherClient = await registerAndGetToken(app, 'client');
      const listingId = await createOpenListing(app, client.token);

      const response = await app.inject({
        method: 'POST',
        url: `/hiring/listings/${listingId}/invitations`,
        headers: { authorization: `Bearer ${client.token}` },
        payload: { creativeAccountId: otherClient.accountId },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /hiring/mine/stats', () => {
    it("returns a creative's stats", async () => {
      const creative = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'GET',
        url: '/hiring/mine/stats',
        headers: { authorization: `Bearer ${creative.token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({ activeContracts: 0, pendingApplications: 0 });
    });

    it("returns a client's stats", async () => {
      const client = await registerAndGetToken(app, 'client');
      const creative = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, client.token);
      await apply(app, creative.token, listingId);

      const response = await app.inject({
        method: 'GET',
        url: '/hiring/mine/stats',
        headers: { authorization: `Bearer ${client.token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({ applicantsWaiting: 1 });
    });
  });
});

// Shared by the contracts/mine and contracts/:id/complete describe blocks — funds escrow,
// applies, and accepts, landing on an active, funded contract.
async function setupAcceptedContract(
  app: FastifyInstance,
  walletService: WalletService,
): Promise<{
  clientToken: string;
  clientAccountId: string;
  creativeToken: string;
  creativeAccountId: string;
  contractId: string;
}> {
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
    throw new Error('setupAcceptedContract: expected a contract to have been created');
  }

  return {
    clientToken: client.token,
    clientAccountId: client.accountId,
    creativeToken: creative.token,
    creativeAccountId: creative.accountId,
    contractId: contract._id.toHexString(),
  };
}
