import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
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
  title: 'Dance Crew Needed for Music Video',
  description: 'Looking for energetic dancers.',
  location: 'Lagos, Nigeria',
  paymentType: 'fixed',
  amountMinor: 10_000_000,
  currency: 'NGN',
  duration: '3 days',
};

async function createListing(app: FastifyInstance, token: string, overrides = {}) {
  return app.inject({
    method: 'POST',
    url: '/listings',
    headers: { authorization: `Bearer ${token}` },
    payload: { ...minimalListing, ...overrides },
  });
}

describe('listings routes', () => {
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
  });

  describe('POST /listings', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/listings',
        payload: minimalListing,
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects a creative account (lacks listings:write)', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const response = await createListing(app, token);
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ success: false, error: 'FORBIDDEN' });
    });

    it('rejects an invalid body', async () => {
      const token = await registerAndGetToken(app, 'client');
      const response = await createListing(app, token, { amountMinor: -5 });
      expect(response.statusCode).toBe(400);
    });

    it('creates a listing for a client account', async () => {
      const token = await registerAndGetToken(app, 'client');
      const response = await createListing(app, token);

      expect(response.statusCode).toBe(201);
      const body = response.json().data;
      expect(body.title).toBe(minimalListing.title);
      expect(body.status).toBe('open');
      expect(body.amountMinor).toBe(10_000_000);
    });
  });

  describe('GET /listings (browse open)', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'GET', url: '/listings' });
      expect(response.statusCode).toBe(401);
    });

    it('returns an empty page when there are no listings', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'GET',
        url: '/listings',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({ items: [], nextCursor: null });
    });

    it('paginates with nextCursor across pages and omits closed listings', async () => {
      const clientToken = await registerAndGetToken(app, 'client');
      for (let i = 0; i < 3; i += 1) {
        await createListing(app, clientToken, { title: `Listing ${i}` });
      }
      const closedResponse = await createListing(app, clientToken, { title: 'Closed listing' });
      await app.inject({
        method: 'POST',
        url: `/listings/${closedResponse.json().data.id}/close`,
        headers: { authorization: `Bearer ${clientToken}` },
      });

      const browseToken = await registerAndGetToken(app, 'creative');

      const firstPage = await app.inject({
        method: 'GET',
        url: '/listings?limit=2',
        headers: { authorization: `Bearer ${browseToken}` },
      });
      expect(firstPage.statusCode).toBe(200);
      const firstBody = firstPage.json().data;
      expect(firstBody.items).toHaveLength(2);
      expect(firstBody.nextCursor).toEqual(expect.any(String));

      const secondPage = await app.inject({
        method: 'GET',
        url: `/listings?limit=2&cursor=${firstBody.nextCursor}`,
        headers: { authorization: `Bearer ${browseToken}` },
      });
      expect(secondPage.statusCode).toBe(200);
      const secondBody = secondPage.json().data;
      expect(secondBody.items).toHaveLength(1);
      expect(secondBody.nextCursor).toBeNull();

      const allIds = [...firstBody.items, ...secondBody.items].map(
        (item: { id: string }) => item.id,
      );
      expect(new Set(allIds).size).toBe(3);
      expect(allIds.every((id) => id !== closedResponse.json().data.id)).toBe(true);
    });
  });

  describe('GET /listings/mine', () => {
    it('rejects an account without listings:write', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'GET',
        url: '/listings/mine',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it("returns only the caller's own listings", async () => {
      const ownerToken = await registerAndGetToken(app, 'client');
      const otherToken = await registerAndGetToken(app, 'client');
      await createListing(app, ownerToken, { title: 'Owner listing' });
      await createListing(app, otherToken, { title: 'Other listing' });

      const response = await app.inject({
        method: 'GET',
        url: '/listings/mine',
        headers: { authorization: `Bearer ${ownerToken}` },
      });

      expect(response.statusCode).toBe(200);
      const items = response.json().data.items;
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Owner listing');
    });
  });

  describe('POST /listings/:id/close', () => {
    it('rejects closing a listing owned by a different client', async () => {
      const ownerToken = await registerAndGetToken(app, 'client');
      const otherToken = await registerAndGetToken(app, 'client');
      const created = await createListing(app, ownerToken);

      const response = await app.inject({
        method: 'POST',
        url: `/listings/${created.json().data.id}/close`,
        headers: { authorization: `Bearer ${otherToken}` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ success: false, error: 'FORBIDDEN' });
    });

    it('closes a listing owned by the caller', async () => {
      const ownerToken = await registerAndGetToken(app, 'client');
      const created = await createListing(app, ownerToken);

      const response = await app.inject({
        method: 'POST',
        url: `/listings/${created.json().data.id}/close`,
        headers: { authorization: `Bearer ${ownerToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.status).toBe('closed');
    });

    it('returns 404 for a listing that does not exist', async () => {
      const token = await registerAndGetToken(app, 'client');
      const response = await app.inject({
        method: 'POST',
        url: '/listings/000000000000000000000000/close',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(404);
    });
  });
});
