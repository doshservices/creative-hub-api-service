import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app.js';
import { PERMISSIONS } from '../../../common/permissions.js';
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
  const token = response.json().data.accessToken as string;
  const payload = app.jwt.decode<{ sub: string }>(token);
  return { token, accountId: payload?.sub as string };
}

// There is no bootstrapping endpoint for the first admin — granting rbac:manage is an ops
// action outside this module's scope, so tests simulate it the same way an ops script would:
// writing the permission directly onto an account, then re-registering... but a JWT already
// issued embeds the *old* permission list, so instead this re-logs-in to get a token that
// reflects the granted permission.
async function grantRbacManage(app: FastifyInstance, accountId: string, email: string) {
  await app.mongo.db
    .collection('accounts')
    .updateOne(
      { _id: new ObjectId(accountId) },
      { $addToSet: { permissions: PERMISSIONS.RBAC_MANAGE } },
    );
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password: 'password123' },
  });
  return response.json().data.accessToken as string;
}

async function registerAdmin(app: FastifyInstance) {
  const email = uniqueEmail();
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email,
      password: 'password123',
      firstName: 'Admin',
      lastName: 'User',
      accountType: 'client',
    },
  });
  const initialToken = response.json().data.accessToken as string;
  const payload = app.jwt.decode<{ sub: string }>(initialToken);
  const accountId = payload?.sub as string;
  const token = await grantRbacManage(app, accountId, email);
  return { token, accountId };
}

describe('rbac routes', () => {
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
    await app.mongo.db.collection('roles').deleteMany({});
    await app.mongo.db.collection('auditEntries').deleteMany({});
  });

  describe('GET /rbac/permissions', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'GET', url: '/rbac/permissions' });
      expect(response.statusCode).toBe(401);
    });

    it('rejects an account without rbac:manage', async () => {
      const { token } = await registerAndGetToken(app, 'client');
      const response = await app.inject({
        method: 'GET',
        url: '/rbac/permissions',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('returns the full permission catalog for an admin', async () => {
      const { token } = await registerAdmin(app);
      const response = await app.inject({
        method: 'GET',
        url: '/rbac/permissions',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data.permissions).toEqual(
        expect.arrayContaining(Object.values(PERMISSIONS)),
      );
    });
  });

  describe('POST /rbac/roles', () => {
    it('rejects an unknown permission in the role', async () => {
      const { token } = await registerAdmin(app);
      const response = await app.inject({
        method: 'POST',
        url: '/rbac/roles',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'bogus-role', permissions: ['not:a:real:permission'] },
      });
      expect(response.statusCode).toBe(400);
    });

    it('creates a role for an admin', async () => {
      const { token } = await registerAdmin(app);
      const response = await app.inject({
        method: 'POST',
        url: '/rbac/roles',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'support-agent', permissions: [PERMISSIONS.LISTINGS_WRITE] },
      });
      expect(response.statusCode).toBe(201);
      expect(response.json().data).toMatchObject({
        name: 'support-agent',
        permissions: [PERMISSIONS.LISTINGS_WRITE],
      });
    });

    it('rejects a duplicate role name', async () => {
      const { token } = await registerAdmin(app);
      const payload = { name: 'support-agent', permissions: [PERMISSIONS.LISTINGS_WRITE] };
      await app.inject({
        method: 'POST',
        url: '/rbac/roles',
        headers: { authorization: `Bearer ${token}` },
        payload,
      });
      const response = await app.inject({
        method: 'POST',
        url: '/rbac/roles',
        headers: { authorization: `Bearer ${token}` },
        payload,
      });
      expect(response.statusCode).toBe(409);
    });
  });

  describe('GET /rbac/roles pagination', () => {
    it('paginates roles', async () => {
      const { token } = await registerAdmin(app);
      for (let i = 0; i < 3; i += 1) {
        await app.inject({
          method: 'POST',
          url: '/rbac/roles',
          headers: { authorization: `Bearer ${token}` },
          payload: { name: `role-${i}`, permissions: [PERMISSIONS.LISTINGS_WRITE] },
        });
      }

      const firstPage = await app.inject({
        method: 'GET',
        url: '/rbac/roles?limit=2',
        headers: { authorization: `Bearer ${token}` },
      });
      const firstBody = firstPage.json().data;
      expect(firstBody.items).toHaveLength(2);
      expect(firstBody.nextCursor).toEqual(expect.any(String));

      const secondPage = await app.inject({
        method: 'GET',
        url: `/rbac/roles?limit=2&cursor=${firstBody.nextCursor}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(secondPage.json().data.items).toHaveLength(1);
    });
  });

  describe('PUT /rbac/roles/:id/permissions', () => {
    it('updates the role and returns the new permission set', async () => {
      const { token } = await registerAdmin(app);
      const createResponse = await app.inject({
        method: 'POST',
        url: '/rbac/roles',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'support-agent', permissions: [PERMISSIONS.LISTINGS_WRITE] },
      });
      const roleId = createResponse.json().data.id as string;

      const response = await app.inject({
        method: 'PUT',
        url: `/rbac/roles/${roleId}/permissions`,
        headers: { authorization: `Bearer ${token}` },
        payload: { permissions: [PERMISSIONS.HIRING_APPLY] },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.permissions).toEqual([PERMISSIONS.HIRING_APPLY]);
    });

    it('returns 404 for a non-existent role', async () => {
      const { token } = await registerAdmin(app);
      const response = await app.inject({
        method: 'PUT',
        url: '/rbac/roles/000000000000000000000000/permissions',
        headers: { authorization: `Bearer ${token}` },
        payload: { permissions: [PERMISSIONS.HIRING_APPLY] },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /rbac/accounts/:accountId/role', () => {
    it('assigns the role, replacing the permission set, and writes an audit entry', async () => {
      const { token: adminToken } = await registerAdmin(app);
      const target = await registerAndGetToken(app, 'creative');

      const roleResponse = await app.inject({
        method: 'POST',
        url: '/rbac/roles',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'support-agent', permissions: [PERMISSIONS.LISTINGS_WRITE] },
      });
      const roleId = roleResponse.json().data.id as string;

      const response = await app.inject({
        method: 'POST',
        url: `/rbac/accounts/${target.accountId}/role`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roleId },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        accountId: target.accountId,
        permissions: [PERMISSIONS.LISTINGS_WRITE],
      });

      const account = await app.mongo.db
        .collection('accounts')
        .findOne({ _id: new ObjectId(target.accountId) });
      expect(account?.permissions).toEqual([PERMISSIONS.LISTINGS_WRITE]);

      const auditEntries = await app.mongo.db
        .collection('auditEntries')
        .find({ action: 'rbac.role_assigned', targetId: target.accountId })
        .toArray();
      expect(auditEntries).toHaveLength(1);
    });

    it('returns 404 for a non-existent account', async () => {
      const { token: adminToken } = await registerAdmin(app);
      const roleResponse = await app.inject({
        method: 'POST',
        url: '/rbac/roles',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'support-agent', permissions: [PERMISSIONS.LISTINGS_WRITE] },
      });
      const roleId = roleResponse.json().data.id as string;

      const response = await app.inject({
        method: 'POST',
        url: '/rbac/accounts/000000000000000000000000/role',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { roleId },
      });
      expect(response.statusCode).toBe(404);
    });
  });
});
