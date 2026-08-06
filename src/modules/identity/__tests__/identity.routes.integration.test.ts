import { createHmac, randomUUID } from 'node:crypto';
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

async function submitVerification(app: FastifyInstance, token: string) {
  return app.inject({
    method: 'POST',
    url: '/identity/verifications',
    headers: { authorization: `Bearer ${token}` },
    payload: { documentKey: `kyc-docs/${randomUUID()}.jpg`, documentType: 'national_id' },
  });
}

async function waitForStatus(
  app: FastifyInstance,
  token: string,
  status: string,
  timeoutMs = 5000,
): Promise<{ statusCode: number; body: { status: string } }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const response = await app.inject({
      method: 'GET',
      url: '/identity/verifications/me',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = response.json().data;
    if (body.status === status || Date.now() > deadline) {
      return { statusCode: response.statusCode, body };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function sign(secret: string, body: Buffer): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

describe('identity routes', () => {
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
    await app.mongo.db.collection('kycVerifications').deleteMany({});
    await app.mongo.db.collection('auditEntries').deleteMany({});
  });

  describe('POST /identity/verifications', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/identity/verifications',
        payload: { documentKey: 'k', documentType: 'national_id' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects a client account (lacks identity:verify)', async () => {
      const token = await registerAndGetToken(app, 'client');
      const response = await submitVerification(app, token);
      expect(response.statusCode).toBe(403);
    });

    it('rejects an invalid body', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'POST',
        url: '/identity/verifications',
        headers: { authorization: `Bearer ${token}` },
        payload: { documentKey: 'k', documentType: 'passport-photo' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('creates a pending verification for a creative account', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const response = await submitVerification(app, token);

      expect(response.statusCode).toBe(201);
      expect(response.json().data).toMatchObject({
        status: 'pending',
        documentType: 'national_id',
      });
    });

    it('moves to failed once the (unreachable, in this test env) Prembly call exhausts retries', async () => {
      const token = await registerAndGetToken(app, 'creative');
      await submitVerification(app, token);

      const { statusCode, body } = await waitForStatus(app, token, 'failed');

      expect(statusCode).toBe(200);
      expect(body.status).toBe('failed');
    }, 10000);
  });

  describe('GET /identity/verifications/me', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'GET', url: '/identity/verifications/me' });
      expect(response.statusCode).toBe(401);
    });

    it('returns 404 before any submission', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'GET',
        url: '/identity/verifications/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /identity/webhooks/prembly', () => {
    const secret = 'dev-webhook-secret'; // matches PREMBLY_WEBHOOK_SECRET in .env

    it('rejects an invalid signature', async () => {
      const payload = Buffer.from(
        JSON.stringify({ reference: '000000000000000000000000', status: 'approved' }),
      );
      const response = await app.inject({
        method: 'POST',
        url: '/identity/webhooks/prembly',
        headers: { 'content-type': 'application/json', 'x-prembly-signature': 'deadbeef' },
        payload,
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects a missing signature header', async () => {
      const payload = Buffer.from(
        JSON.stringify({ reference: '000000000000000000000000', status: 'approved' }),
      );
      const response = await app.inject({
        method: 'POST',
        url: '/identity/webhooks/prembly',
        headers: { 'content-type': 'application/json' },
        payload,
      });
      expect(response.statusCode).toBe(401);
    });

    it('acknowledges a validly signed payload for an unknown reference without erroring', async () => {
      const payload = Buffer.from(
        JSON.stringify({ reference: '000000000000000000000000', status: 'approved' }),
      );
      const response = await app.inject({
        method: 'POST',
        url: '/identity/webhooks/prembly',
        headers: {
          'content-type': 'application/json',
          'x-prembly-signature': sign(secret, payload),
        },
        payload,
      });
      expect(response.statusCode).toBe(204);
    });

    it('updates the verification, records an audit entry, and is idempotent on redelivery', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const submitResponse = await submitVerification(app, token);
      const verificationId = submitResponse.json().data.id as string;

      const payload = Buffer.from(
        JSON.stringify({ reference: verificationId, status: 'approved' }),
      );
      const signature = sign(secret, payload);

      const firstDelivery = await app.inject({
        method: 'POST',
        url: '/identity/webhooks/prembly',
        headers: { 'content-type': 'application/json', 'x-prembly-signature': signature },
        payload,
      });
      expect(firstDelivery.statusCode).toBe(204);

      const afterFirst = await app.inject({
        method: 'GET',
        url: '/identity/verifications/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(afterFirst.json().data.status).toBe('approved');

      const auditEntries = await app.mongo.db
        .collection('auditEntries')
        .find({ action: 'identity.kyc_result' })
        .toArray();
      expect(auditEntries).toHaveLength(1);
      expect(auditEntries[0]?.targetId).toBe(verificationId);

      // Redelivery of the exact same event — must not double-audit.
      const secondDelivery = await app.inject({
        method: 'POST',
        url: '/identity/webhooks/prembly',
        headers: { 'content-type': 'application/json', 'x-prembly-signature': signature },
        payload,
      });
      expect(secondDelivery.statusCode).toBe(204);

      const auditEntriesAfterRedelivery = await app.mongo.db
        .collection('auditEntries')
        .find({ action: 'identity.kyc_result' })
        .toArray();
      expect(auditEntriesAfterRedelivery).toHaveLength(1);
    });
  });
});
