import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app.js';
import { PERMISSIONS } from '../../../common/permissions.js';
import type { AccountType } from '../model.js';

function uniqueEmail(): string {
  return `test-${randomUUID()}@example.com`;
}

async function register(
  app: FastifyInstance,
  email: string,
  overrides: { password?: string; accountType?: AccountType } = {},
) {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email,
      password: overrides.password ?? 'password123',
      firstName: 'Dev',
      lastName: 'User',
      accountType: overrides.accountType ?? 'creative',
    },
  });
  return response;
}

describe('auth routes', () => {
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

  it('registers a new account and returns tokens', async () => {
    const response = await register(app, uniqueEmail());

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toEqual(expect.any(String));
    expect(body.data.refreshToken).toEqual(expect.any(String));
  });

  it('rejects registration with a duplicate email', async () => {
    const email = uniqueEmail();
    await register(app, email);

    const response = await register(app, email);

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ success: false, error: 'CONFLICT' });
  });

  it('rejects registration when the body fails schema validation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'not-an-email', password: 'short' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ success: false, error: 'BAD_REQUEST' });
  });

  it('rejects registration with an accountType outside client/creative', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: uniqueEmail(),
        password: 'password123',
        firstName: 'Dev',
        lastName: 'User',
        accountType: 'admin',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ success: false, error: 'BAD_REQUEST' });
  });

  it('strips client-supplied permissions/status fields on register', async () => {
    const email = uniqueEmail();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email,
        password: 'password123',
        firstName: 'Dev',
        lastName: 'User',
        accountType: 'creative',
        permissions: ['wallet:debit'],
        status: 'suspended',
      },
    });

    expect(response.statusCode).toBe(201);

    const account = await app.mongo.db.collection('accounts').findOne({ email });
    expect(account?.permissions).toEqual([
      PERMISSIONS.CREATIVE_PROFILE_WRITE,
      PERMISSIONS.HIRING_APPLY,
      PERMISSIONS.IDENTITY_VERIFY,
      PERMISSIONS.PAYMENTS_INITIATE,
      PERMISSIONS.FILES_UPLOAD,
      PERMISSIONS.COLLABORATION_SUBMIT,
      PERMISSIONS.REVIEWS_SUBMIT,
    ]);
    expect(account?.status).toBe('active');
  });

  it.each<[AccountType, string[]]>([
    [
      'creative',
      [
        PERMISSIONS.CREATIVE_PROFILE_WRITE,
        PERMISSIONS.HIRING_APPLY,
        PERMISSIONS.IDENTITY_VERIFY,
        PERMISSIONS.PAYMENTS_INITIATE,
        PERMISSIONS.FILES_UPLOAD,
        PERMISSIONS.COLLABORATION_SUBMIT,
        PERMISSIONS.REVIEWS_SUBMIT,
      ],
    ],
    [
      'client',
      [
        PERMISSIONS.LISTINGS_WRITE,
        PERMISSIONS.PAYMENTS_INITIATE,
        PERMISSIONS.FILES_UPLOAD,
        PERMISSIONS.COLLABORATION_REVIEW,
        PERMISSIONS.EMPLOYER_PROFILE_WRITE,
        PERMISSIONS.EVENTS_WRITE,
        PERMISSIONS.REVIEWS_SUBMIT,
      ],
    ],
  ])('grants the default permission set for a %s account', async (accountType, permissions) => {
    const email = uniqueEmail();
    await register(app, email, { accountType });

    const account = await app.mongo.db.collection('accounts').findOne({ email });
    expect(account?.accountType).toBe(accountType);
    expect(account?.permissions).toEqual(permissions);
  });

  it('logs in with correct credentials and records an audit entry', async () => {
    const email = uniqueEmail();
    await register(app, email);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'password123' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.accessToken).toEqual(expect.any(String));

    const auditEntries = await app.mongo.db
      .collection('auditEntries')
      .find({ action: 'auth.login' })
      .toArray();
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0]?.targetType).toBe('account');
  });

  it('rejects login with an incorrect password', async () => {
    const email = uniqueEmail();
    await register(app, email);

    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'wrong-password' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ success: false, error: 'UNAUTHORIZED' });
  });

  it('refreshes an access token and rotates the refresh token, rejecting reuse', async () => {
    const registerResponse = await register(app, uniqueEmail());
    const { refreshToken } = registerResponse.json().data;

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });

    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshResponse.json().data.refreshToken).not.toBe(refreshToken);

    const reuseResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(reuseResponse.statusCode).toBe(401);
  });

  it('logs out and invalidates the refresh token', async () => {
    const registerResponse = await register(app, uniqueEmail());
    const { refreshToken } = registerResponse.json().data;

    const logoutResponse = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken },
    });
    expect(logoutResponse.statusCode).toBe(204);

    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(refreshResponse.statusCode).toBe(401);
  });

  describe('GET /auth/me', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'GET', url: '/auth/me' });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({ success: false, error: 'UNAUTHORIZED' });
    });

    it('rejects a malformed access token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: 'Bearer not-a-real-token' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('returns the calling account, derived from the token — not a client-supplied id', async () => {
      const email = uniqueEmail();
      const registerResponse = await register(app, email);
      const { accessToken } = registerResponse.json().data;

      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.email).toBe(email);
      expect(body.data).not.toHaveProperty('passwordHash');
    });
  });

  describe('PUT /auth/me/password', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/auth/me/password',
        payload: { currentPassword: 'password123', newPassword: 'newpassword456' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects the wrong current password', async () => {
      const registerResponse = await register(app, uniqueEmail());
      const { accessToken } = registerResponse.json().data;

      const response = await app.inject({
        method: 'PUT',
        url: '/auth/me/password',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { currentPassword: 'wrong-password', newPassword: 'newpassword456' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('changes the password, records an audit entry, and the new password works for login', async () => {
      const email = uniqueEmail();
      const registerResponse = await register(app, email);
      const { accessToken } = registerResponse.json().data;

      const response = await app.inject({
        method: 'PUT',
        url: '/auth/me/password',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { currentPassword: 'password123', newPassword: 'newpassword456' },
      });
      expect(response.statusCode).toBe(204);

      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: 'newpassword456' },
      });
      expect(loginResponse.statusCode).toBe(200);

      const auditEntries = await app.mongo.db
        .collection('auditEntries')
        .find({ action: 'auth.password_changed' })
        .toArray();
      expect(auditEntries).toHaveLength(1);
    });
  });

  describe('admin account suspend/reactivate', () => {
    async function getAccountId(accessToken: string): Promise<string> {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      return response.json().data.id as string;
    }

    // There's no self-service way to become an admin — a real operator grants this via rbac's
    // role-assignment flow; directly setting permissions here stands in for that.
    async function loginAsAdmin(): Promise<string> {
      const adminEmail = uniqueEmail();
      await register(app, adminEmail);
      await app.mongo.db
        .collection('accounts')
        .updateOne({ email: adminEmail }, { $set: { permissions: [PERMISSIONS.ADMIN_USERS_MANAGE] } });
      const loginResponse = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: adminEmail, password: 'password123' },
      });
      return loginResponse.json().data.accessToken as string;
    }

    it('rejects suspend without ADMIN_USERS_MANAGE', async () => {
      const targetResponse = await register(app, uniqueEmail());
      const targetId = await getAccountId(targetResponse.json().data.accessToken);
      const { accessToken } = (await register(app, uniqueEmail())).json().data;

      const response = await app.inject({
        method: 'PUT',
        url: `/auth/admin/accounts/${targetId}/suspend`,
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('suspends and reactivates an account, recording audit entries', async () => {
      const targetRegisterResponse = await register(app, uniqueEmail());
      const targetId = await getAccountId(targetRegisterResponse.json().data.accessToken);
      const adminAccessToken = await loginAsAdmin();

      const suspendResponse = await app.inject({
        method: 'PUT',
        url: `/auth/admin/accounts/${targetId}/suspend`,
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });
      expect(suspendResponse.statusCode).toBe(200);
      expect(suspendResponse.json().data.status).toBe('suspended');

      const reactivateResponse = await app.inject({
        method: 'PUT',
        url: `/auth/admin/accounts/${targetId}/reactivate`,
        headers: { authorization: `Bearer ${adminAccessToken}` },
      });
      expect(reactivateResponse.statusCode).toBe(200);
      expect(reactivateResponse.json().data.status).toBe('active');

      const auditEntries = await app.mongo.db
        .collection('auditEntries')
        .find({ targetId, action: { $in: ['auth.account_suspended', 'auth.account_reactivated'] } })
        .toArray();
      expect(auditEntries).toHaveLength(2);
    });
  });
});
