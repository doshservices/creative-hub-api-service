import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app.js';
import { PERMISSIONS } from '../../../common/permissions.js';

function uniqueEmail(): string {
  return `test-${randomUUID()}@example.com`;
}

async function registerAndGetToken(
  app: FastifyInstance,
): Promise<{ token: string; accountId: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email: uniqueEmail(),
      password: 'password123',
      firstName: 'Dev',
      lastName: 'User',
      accountType: 'creative',
    },
  });
  const token = response.json().data.accessToken as string;
  const payload = app.jwt.decode<{ sub: string }>(token);
  return { token, accountId: payload?.sub as string };
}

// There's no self-service way to become an admin — a real operator grants this via rbac's
// role-assignment flow; directly setting permissions here stands in for that, same pattern as
// auth.routes.integration.test.ts's and admin.routes.integration.test.ts's loginAsAdmin.
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
  await app.mongo.db
    .collection('accounts')
    .updateOne({ email: adminEmail }, { $set: { permissions: [PERMISSIONS.AUDIT_READ] } });
  const loginResponse = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: adminEmail, password: 'password123' },
  });
  return loginResponse.json().data.accessToken as string;
}

describe('audit routes', () => {
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
    await app.mongo.db.collection('auditEntries').deleteMany({});
  });

  describe('GET /admin/audit', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'GET', url: '/admin/audit' });
      expect(response.statusCode).toBe(401);
    });

    it('rejects an account without AUDIT_READ', async () => {
      const { token } = await registerAndGetToken(app);
      const response = await app.inject({
        method: 'GET',
        url: '/admin/audit',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('returns an empty page when no entries match the filter', async () => {
      // loginAsAdmin itself writes an 'auth.login' entry, so assert emptiness via a filter that
      // can't match anything yet, rather than an unfiltered query against a truly empty
      // collection.
      const adminToken = await loginAsAdmin(app);
      const response = await app.inject({
        method: 'GET',
        url: '/admin/audit?action=nonexistent.action',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({ items: [], nextCursor: null });
    });

    it('lists entries written by other modules, newest first', async () => {
      const adminToken = await loginAsAdmin(app);
      // A real audit-worthy action written by another module (auth), not a directly-inserted
      // fixture — logging in successfully writes an 'auth.login' entry.
      const email = uniqueEmail();
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email,
          password: 'password123',
          firstName: 'Dev',
          lastName: 'User',
          accountType: 'creative',
        },
      });
      await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'password123' },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/admin/audit',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const items = response.json().data.items;
      expect(items.length).toBeGreaterThan(0);
      expect(items[0]).toMatchObject({
        action: 'auth.login',
        actorId: expect.any(String),
      });
    });

    it('filters by action', async () => {
      const adminToken = await loginAsAdmin(app);
      const account = await registerAndGetToken(app);
      await app.audit.record({
        actorId: account.accountId,
        action: 'custom.test_action',
        targetType: 'account',
        targetId: account.accountId,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/admin/audit?action=custom.test_action',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const items = response.json().data.items;
      expect(items).toHaveLength(1);
      expect(items[0].action).toBe('custom.test_action');
    });

    it('filters by actorId', async () => {
      const adminToken = await loginAsAdmin(app);
      const accountA = await registerAndGetToken(app);
      const accountB = await registerAndGetToken(app);
      await app.audit.record({
        actorId: accountA.accountId,
        action: 'custom.a_action',
        targetType: 'account',
        targetId: accountA.accountId,
      });
      await app.audit.record({
        actorId: accountB.accountId,
        action: 'custom.b_action',
        targetType: 'account',
        targetId: accountB.accountId,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/admin/audit?actorId=${accountA.accountId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const items = response.json().data.items;
      expect(items).toHaveLength(1);
      expect(items[0].actorId).toBe(accountA.accountId);
    });

    it('rejects a malformed "from" date', async () => {
      const adminToken = await loginAsAdmin(app);
      const response = await app.inject({
        method: 'GET',
        url: '/admin/audit?from=not-a-date',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(response.statusCode).toBe(400);
    });

    it('paginates with nextCursor across pages', async () => {
      const adminToken = await loginAsAdmin(app);
      const account = await registerAndGetToken(app);
      for (let i = 0; i < 3; i += 1) {
        await app.audit.record({
          actorId: account.accountId,
          action: 'custom.paginated_action',
          targetType: 'account',
          targetId: account.accountId,
        });
      }

      const firstPage = await app.inject({
        method: 'GET',
        url: '/admin/audit?action=custom.paginated_action&limit=2',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const firstBody = firstPage.json().data;
      expect(firstBody.items).toHaveLength(2);
      expect(firstBody.nextCursor).toEqual(expect.any(String));

      const secondPage = await app.inject({
        method: 'GET',
        url: `/admin/audit?action=custom.paginated_action&limit=2&cursor=${firstBody.nextCursor}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const secondBody = secondPage.json().data;
      expect(secondBody.items).toHaveLength(1);
      expect(secondBody.nextCursor).toBeNull();
    });
  });
});
