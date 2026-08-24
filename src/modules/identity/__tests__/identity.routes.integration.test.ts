import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app.js';
import type { AccountType } from '../../auth/model.js';
import { KycVerificationRepository } from '../repository.js';
import { IdentityService } from '../service.js';

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
    payload: {
      documentKey: `kyc-docs/${randomUUID()}.jpg`,
      documentType: 'national_id',
      documentCountry: 'NGA',
    },
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
        payload: { documentKey: 'k', documentType: 'national_id', documentCountry: 'NGA' },
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
        payload: { documentKey: 'k', documentType: 'passport-photo', documentCountry: 'NGA' },
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

      // Each retry now makes a real (failing, since the object was never uploaded) S3 call
      // before ever reaching the unreachable Prembly URL, so this needs more headroom than a
      // purely local/synchronous failure would.
      const { statusCode, body } = await waitForStatus(app, token, 'failed', 15000);

      expect(statusCode).toBe(200);
      expect(body.status).toBe('failed');
    }, 20000);
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

  // The KYC worker calls Prembly's document-verification endpoint synchronously and applies
  // whatever verdict comes back via IdentityService.applyProviderResult — there's no webhook
  // route to hit here, so this exercises that same result-application path directly against the
  // app's real Mongo/audit plugin (only the Prembly HTTP call itself is out of scope — that's
  // exactly the "provider client" the test-suite skill allows faking).
  describe('KYC result application (worker path)', () => {
    it('updates the verification, records an audit entry, and is idempotent on reapplication', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const submitResponse = await submitVerification(app, token);
      const verificationId = submitResponse.json().data.id as string;

      const repository = new KycVerificationRepository(app.mongo.db);
      const service = new IdentityService(
        repository,
        { enqueueVerification: async () => {} },
        app.audit,
      );

      await service.applyProviderResult(verificationId, 'approved', 'prembly-ref-1', null);

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

      // A retried job re-applying the same terminal status — must not double-audit.
      await service.applyProviderResult(verificationId, 'approved', 'prembly-ref-1', null);

      const auditEntriesAfterRetry = await app.mongo.db
        .collection('auditEntries')
        .find({ action: 'identity.kyc_result' })
        .toArray();
      expect(auditEntriesAfterRetry).toHaveLength(1);
    });

    it('acknowledges an unknown verification id without erroring or auditing', async () => {
      const repository = new KycVerificationRepository(app.mongo.db);
      const service = new IdentityService(
        repository,
        { enqueueVerification: async () => {} },
        app.audit,
      );

      await expect(
        service.applyProviderResult('000000000000000000000000', 'approved', 'ref', null),
      ).resolves.toBeUndefined();

      const auditEntries = await app.mongo.db
        .collection('auditEntries')
        .find({ action: 'identity.kyc_result' })
        .toArray();
      expect(auditEntries).toHaveLength(0);
    });
  });
});
