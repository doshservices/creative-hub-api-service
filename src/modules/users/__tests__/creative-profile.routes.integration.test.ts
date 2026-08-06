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
  const { accessToken } = response.json().data;
  return accessToken as string;
}

const minimalProfile = {
  primaryRole: 'Dancer',
  skills: ['Contemporary Dance', 'Hip-Hop'],
};

describe('users routes (creative profile)', () => {
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
    await app.mongo.db.collection('creativeProfiles').deleteMany({});
  });

  describe('PUT /users/me/creative-profile', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/users/me/creative-profile',
        payload: minimalProfile,
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects a client account (lacks profile:creative:write)', async () => {
      const accessToken = await registerAndGetToken(app, 'client');

      const response = await app.inject({
        method: 'PUT',
        url: '/users/me/creative-profile',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: minimalProfile,
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ success: false, error: 'FORBIDDEN' });
    });

    it('rejects a body missing required fields', async () => {
      const accessToken = await registerAndGetToken(app, 'creative');

      const response = await app.inject({
        method: 'PUT',
        url: '/users/me/creative-profile',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { primaryRole: 'Dancer' }, // missing skills
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ success: false, error: 'BAD_REQUEST' });
    });

    it('creates the profile for a creative account and is idempotent on repeat calls', async () => {
      const accessToken = await registerAndGetToken(app, 'creative');

      const createResponse = await app.inject({
        method: 'PUT',
        url: '/users/me/creative-profile',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: minimalProfile,
      });
      expect(createResponse.statusCode).toBe(200);
      expect(createResponse.json().data).toMatchObject({
        primaryRole: 'Dancer',
        skills: ['Contemporary Dance', 'Hip-Hop'],
      });

      const updateResponse = await app.inject({
        method: 'PUT',
        url: '/users/me/creative-profile',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { ...minimalProfile, bio: 'Updated bio' },
      });
      expect(updateResponse.statusCode).toBe(200);
      const updated = updateResponse.json().data;
      expect(updated.bio).toBe('Updated bio');
      expect(updated.id).toBe(createResponse.json().data.id);

      const count = await app.mongo.db.collection('creativeProfiles').countDocuments();
      expect(count).toBe(1);
    });
  });

  describe('GET /users/me/creative-profile', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'GET', url: '/users/me/creative-profile' });
      expect(response.statusCode).toBe(401);
    });

    it('returns 404 before any profile has been created', async () => {
      const accessToken = await registerAndGetToken(app, 'creative');

      const response = await app.inject({
        method: 'GET',
        url: '/users/me/creative-profile',
        headers: { authorization: `Bearer ${accessToken}` },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ success: false, error: 'NOT_FOUND' });
    });

    it("returns only the caller's own profile, never another account's", async () => {
      const ownerToken = await registerAndGetToken(app, 'creative');
      const otherToken = await registerAndGetToken(app, 'creative');

      await app.inject({
        method: 'PUT',
        url: '/users/me/creative-profile',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { primaryRole: 'Owner Role', skills: ['Skill A'] },
      });

      const ownerResponse = await app.inject({
        method: 'GET',
        url: '/users/me/creative-profile',
        headers: { authorization: `Bearer ${ownerToken}` },
      });
      expect(ownerResponse.json().data.primaryRole).toBe('Owner Role');

      const otherResponse = await app.inject({
        method: 'GET',
        url: '/users/me/creative-profile',
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(otherResponse.statusCode).toBe(404);
    });
  });

  describe('POST /users/me/creative-profile/upload-url', () => {
    it('rejects a client account', async () => {
      const accessToken = await registerAndGetToken(app, 'client');

      const response = await app.inject({
        method: 'POST',
        url: '/users/me/creative-profile/upload-url',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { purpose: 'profile-photo', contentType: 'image/png' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('rejects an unsupported content type', async () => {
      const accessToken = await registerAndGetToken(app, 'creative');

      const response = await app.inject({
        method: 'POST',
        url: '/users/me/creative-profile/upload-url',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { purpose: 'profile-photo', contentType: 'application/x-msdownload' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns a presigned upload URL and object key for a creative account', async () => {
      const accessToken = await registerAndGetToken(app, 'creative');

      const response = await app.inject({
        method: 'POST',
        url: '/users/me/creative-profile/upload-url',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { purpose: 'portfolio', contentType: 'application/pdf' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.data.key).toMatch(/^portfolio\//);
      expect(body.data.uploadUrl).toEqual(expect.any(String));
      expect(body.data.uploadUrl.startsWith('http')).toBe(true);
    });
  });
});
