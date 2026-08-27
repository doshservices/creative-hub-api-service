import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
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
  title: 'Dance Crew Needed',
  description: 'Looking for dancers.',
  location: 'Lagos, Nigeria',
  paymentType: 'fixed',
  amountMinor: 10_000_000,
  currency: 'NGN',
  duration: '3 days',
};

async function setupActiveContract(app: FastifyInstance) {
  const clientToken = await registerAndGetToken(app, 'client');
  const creativeToken = await registerAndGetToken(app, 'creative');

  const listingResponse = await app.inject({
    method: 'POST',
    url: '/listings',
    headers: { authorization: `Bearer ${clientToken}` },
    payload: minimalListing,
  });
  const listingId = listingResponse.json().data.id as string;

  const applyResponse = await app.inject({
    method: 'POST',
    url: '/hiring/applications',
    headers: { authorization: `Bearer ${creativeToken}` },
    payload: { listingId },
  });
  const applicationId = applyResponse.json().data.id as string;

  await app.inject({
    method: 'PUT',
    url: `/hiring/applications/${applicationId}/status`,
    headers: { authorization: `Bearer ${clientToken}` },
    payload: { status: 'accepted' },
  });

  const contract = await app.mongo.db
    .collection('contracts')
    .findOne({ applicationId: new ObjectId(applicationId) });
  const contractId = (contract?._id as ObjectId).toHexString();

  return { clientToken, creativeToken, contractId };
}

async function confirmedFile(app: FastifyInstance, token: string) {
  const createResponse = await app.inject({
    method: 'POST',
    url: '/files/upload-url',
    headers: { authorization: `Bearer ${token}` },
    payload: { purpose: 'contract-deliverable', contentType: 'image/png' },
  });
  const fileId = createResponse.json().data.id as string;
  await app.inject({
    method: 'POST',
    url: `/files/${fileId}/confirm`,
    headers: { authorization: `Bearer ${token}` },
  });
  return fileId;
}

describe('collaboration routes', () => {
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
    await app.mongo.db.collection('files').deleteMany({});
    await app.mongo.db.collection('deliverables').deleteMany({});
  });

  describe('POST /collaboration/contracts/:contractId/deliverables', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/collaboration/contracts/000000000000000000000000/deliverables',
        payload: { fileId: '000000000000000000000000' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects a client account (lacks collaboration:submit)', async () => {
      const { clientToken, contractId } = await setupActiveContract(app);
      const fileId = await confirmedFile(app, clientToken);

      const response = await app.inject({
        method: 'POST',
        url: `/collaboration/contracts/${contractId}/deliverables`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: { fileId },
      });
      expect(response.statusCode).toBe(403);
    });

    it('rejects a creative who is not the one on this contract', async () => {
      const { contractId } = await setupActiveContract(app);
      const otherCreativeToken = await registerAndGetToken(app, 'creative');
      const fileId = await confirmedFile(app, otherCreativeToken);

      const response = await app.inject({
        method: 'POST',
        url: `/collaboration/contracts/${contractId}/deliverables`,
        headers: { authorization: `Bearer ${otherCreativeToken}` },
        payload: { fileId },
      });
      expect(response.statusCode).toBe(403);
    });

    it('rejects a file that has not been confirmed', async () => {
      const { creativeToken, contractId } = await setupActiveContract(app);
      const createResponse = await app.inject({
        method: 'POST',
        url: '/files/upload-url',
        headers: { authorization: `Bearer ${creativeToken}` },
        payload: { purpose: 'contract-deliverable', contentType: 'image/png' },
      });
      const fileId = createResponse.json().data.id as string;

      const response = await app.inject({
        method: 'POST',
        url: `/collaboration/contracts/${contractId}/deliverables`,
        headers: { authorization: `Bearer ${creativeToken}` },
        payload: { fileId },
      });
      expect(response.statusCode).toBe(409);
    });

    it('submits a deliverable for the active contract', async () => {
      const { creativeToken, contractId } = await setupActiveContract(app);
      const fileId = await confirmedFile(app, creativeToken);

      const response = await app.inject({
        method: 'POST',
        url: `/collaboration/contracts/${contractId}/deliverables`,
        headers: { authorization: `Bearer ${creativeToken}` },
        payload: { fileId, note: 'first draft' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data).toMatchObject({
        contractId,
        fileId,
        note: 'first draft',
        status: 'submitted',
      });
    });
  });

  describe('GET /collaboration/contracts/:contractId/deliverables', () => {
    it('rejects an account not party to the contract', async () => {
      const { contractId } = await setupActiveContract(app);
      const outsiderToken = await registerAndGetToken(app, 'client');

      const response = await app.inject({
        method: 'GET',
        url: `/collaboration/contracts/${contractId}/deliverables`,
        headers: { authorization: `Bearer ${outsiderToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('lists deliverables for the client', async () => {
      const { clientToken, creativeToken, contractId } = await setupActiveContract(app);
      const fileId = await confirmedFile(app, creativeToken);
      await app.inject({
        method: 'POST',
        url: `/collaboration/contracts/${contractId}/deliverables`,
        headers: { authorization: `Bearer ${creativeToken}` },
        payload: { fileId },
      });

      const response = await app.inject({
        method: 'GET',
        url: `/collaboration/contracts/${contractId}/deliverables`,
        headers: { authorization: `Bearer ${clientToken}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data.items).toHaveLength(1);
    });
  });

  describe('PUT /collaboration/deliverables/:id/review', () => {
    async function setupDeliverable(app: FastifyInstance) {
      const { clientToken, creativeToken, contractId } = await setupActiveContract(app);
      const fileId = await confirmedFile(app, creativeToken);
      const submitResponse = await app.inject({
        method: 'POST',
        url: `/collaboration/contracts/${contractId}/deliverables`,
        headers: { authorization: `Bearer ${creativeToken}` },
        payload: { fileId },
      });
      return {
        clientToken,
        creativeToken,
        deliverableId: submitResponse.json().data.id as string,
      };
    }

    it('rejects the creative reviewing their own submission (lacks collaboration:review)', async () => {
      const { creativeToken, deliverableId } = await setupDeliverable(app);
      const response = await app.inject({
        method: 'PUT',
        url: `/collaboration/deliverables/${deliverableId}/review`,
        headers: { authorization: `Bearer ${creativeToken}` },
        payload: { status: 'approved' },
      });
      expect(response.statusCode).toBe(403);
    });

    it('rejects a client who is not on this contract', async () => {
      const { deliverableId } = await setupDeliverable(app);
      const otherClientToken = await registerAndGetToken(app, 'client');

      const response = await app.inject({
        method: 'PUT',
        url: `/collaboration/deliverables/${deliverableId}/review`,
        headers: { authorization: `Bearer ${otherClientToken}` },
        payload: { status: 'approved' },
      });
      expect(response.statusCode).toBe(403);
    });

    it('approves a deliverable', async () => {
      const { clientToken, deliverableId } = await setupDeliverable(app);
      const response = await app.inject({
        method: 'PUT',
        url: `/collaboration/deliverables/${deliverableId}/review`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: { status: 'approved', reviewNote: 'ship it' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({ status: 'approved', reviewNote: 'ship it' });
    });

    it('rejects reviewing an already-reviewed deliverable', async () => {
      const { clientToken, deliverableId } = await setupDeliverable(app);
      await app.inject({
        method: 'PUT',
        url: `/collaboration/deliverables/${deliverableId}/review`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: { status: 'approved' },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/collaboration/deliverables/${deliverableId}/review`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: { status: 'revision_requested' },
      });
      expect(response.statusCode).toBe(409);
    });
  });
});
