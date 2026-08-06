import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app.js';
import type { AccountType } from '../../auth/model.js';

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
  return response.json().data.accessToken as string;
}

const minimalListing = {
  title: 'Dance Crew Needed',
  description: 'Looking for dancers.',
  location: 'Lagos, Nigeria',
  paymentType: 'fixed',
  amountMinor: 10_000_000,
  currency: 'NGN',
  duration: '3 days',
};

async function createOpenListing(app: FastifyInstance, clientToken: string) {
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

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
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
      const clientToken = await registerAndGetToken(app, 'client');
      const listingId = await createOpenListing(app, clientToken);

      const response = await apply(app, clientToken, listingId);

      expect(response.statusCode).toBe(403);
    });

    it('rejects applying to a listing that does not exist', async () => {
      const creativeToken = await registerAndGetToken(app, 'creative');
      const response = await apply(app, creativeToken, '000000000000000000000000');
      expect(response.statusCode).toBe(404);
    });

    it('rejects applying to a closed listing', async () => {
      const clientToken = await registerAndGetToken(app, 'client');
      const creativeToken = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, clientToken);
      await app.inject({
        method: 'POST',
        url: `/listings/${listingId}/close`,
        headers: { authorization: `Bearer ${clientToken}` },
      });

      const response = await apply(app, creativeToken, listingId);
      expect(response.statusCode).toBe(409);
    });

    it('creates an application for a creative account', async () => {
      const clientToken = await registerAndGetToken(app, 'client');
      const creativeToken = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, clientToken);

      const response = await apply(app, creativeToken, listingId);

      expect(response.statusCode).toBe(201);
      expect(response.json().data).toMatchObject({ listingId, status: 'pending' });
    });

    it('rejects a duplicate application to the same listing', async () => {
      const clientToken = await registerAndGetToken(app, 'client');
      const creativeToken = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, clientToken);

      await apply(app, creativeToken, listingId);
      const response = await apply(app, creativeToken, listingId);

      expect(response.statusCode).toBe(409);
    });
  });

  describe('GET /hiring/applications/mine', () => {
    it('returns an empty page when the creative has not applied to anything', async () => {
      const creativeToken = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'GET',
        url: '/hiring/applications/mine',
        headers: { authorization: `Bearer ${creativeToken}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({ items: [], nextCursor: null });
    });

    it("paginates the creative's own applications", async () => {
      const clientToken = await registerAndGetToken(app, 'client');
      const creativeToken = await registerAndGetToken(app, 'creative');
      for (let i = 0; i < 3; i += 1) {
        const listingId = await createOpenListing(app, clientToken);
        await apply(app, creativeToken, listingId);
      }

      const firstPage = await app.inject({
        method: 'GET',
        url: '/hiring/applications/mine?limit=2',
        headers: { authorization: `Bearer ${creativeToken}` },
      });
      const firstBody = firstPage.json().data;
      expect(firstBody.items).toHaveLength(2);
      expect(firstBody.nextCursor).toEqual(expect.any(String));

      const secondPage = await app.inject({
        method: 'GET',
        url: `/hiring/applications/mine?limit=2&cursor=${firstBody.nextCursor}`,
        headers: { authorization: `Bearer ${creativeToken}` },
      });
      const secondBody = secondPage.json().data;
      expect(secondBody.items).toHaveLength(1);
      expect(secondBody.nextCursor).toBeNull();
    });
  });

  describe('GET /hiring/listings/:listingId/applications', () => {
    it('rejects a client who does not own the listing', async () => {
      const ownerToken = await registerAndGetToken(app, 'client');
      const otherClientToken = await registerAndGetToken(app, 'client');
      const creativeToken = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, ownerToken);
      await apply(app, creativeToken, listingId);

      const response = await app.inject({
        method: 'GET',
        url: `/hiring/listings/${listingId}/applications`,
        headers: { authorization: `Bearer ${otherClientToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('returns applications for the owning client', async () => {
      const ownerToken = await registerAndGetToken(app, 'client');
      const creativeToken = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, ownerToken);
      await apply(app, creativeToken, listingId);

      const response = await app.inject({
        method: 'GET',
        url: `/hiring/listings/${listingId}/applications`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.items).toHaveLength(1);
    });
  });

  describe('PUT /hiring/applications/:id/status', () => {
    async function setupApplication(app: FastifyInstance) {
      const clientToken = await registerAndGetToken(app, 'client');
      const creativeToken = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, clientToken);
      const applyResponse = await apply(app, creativeToken, listingId);
      return { clientToken, creativeToken, applicationId: applyResponse.json().data.id as string };
    }

    it('rejects a client who does not own the application', async () => {
      const { applicationId } = await setupApplication(app);
      const otherClientToken = await registerAndGetToken(app, 'client');

      const response = await app.inject({
        method: 'PUT',
        url: `/hiring/applications/${applicationId}/status`,
        headers: { authorization: `Bearer ${otherClientToken}` },
        payload: { status: 'accepted' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('accepting an application creates a contract with an audit entry', async () => {
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

  describe('GET /hiring/contracts/mine', () => {
    it('returns an empty page when there are no contracts', async () => {
      const clientToken = await registerAndGetToken(app, 'client');
      const response = await app.inject({
        method: 'GET',
        url: '/hiring/contracts/mine',
        headers: { authorization: `Bearer ${clientToken}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({ items: [], nextCursor: null });
    });

    it('returns the contract for both the client and the creative side', async () => {
      const clientToken = await registerAndGetToken(app, 'client');
      const creativeToken = await registerAndGetToken(app, 'creative');
      const listingId = await createOpenListing(app, clientToken);
      const applyResponse = await apply(app, creativeToken, listingId);
      await app.inject({
        method: 'PUT',
        url: `/hiring/applications/${applyResponse.json().data.id}/status`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: { status: 'accepted' },
      });

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
});
