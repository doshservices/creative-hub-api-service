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

describe('files routes', () => {
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
    await app.mongo.db.collection('files').deleteMany({});
  });

  describe('POST /files/upload-url', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/files/upload-url',
        payload: { purpose: 'portfolio', contentType: 'image/png' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects an unsupported content type', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'POST',
        url: '/files/upload-url',
        headers: { authorization: `Bearer ${token}` },
        payload: { purpose: 'portfolio', contentType: 'application/x-msdownload' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects an invalid purpose', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'POST',
        url: '/files/upload-url',
        headers: { authorization: `Bearer ${token}` },
        payload: { purpose: 'Not Valid!', contentType: 'image/png' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('returns a presigned upload url and a pending file record', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'POST',
        url: '/files/upload-url',
        headers: { authorization: `Bearer ${token}` },
        payload: { purpose: 'contract-deliverable', contentType: 'application/pdf' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json().data;
      expect(body.key).toMatch(/^contract-deliverable\//);
      expect(body.uploadUrl).toEqual(expect.stringContaining('http'));

      const getResponse = await app.inject({
        method: 'GET',
        url: `/files/${body.id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getResponse.json().data.status).toBe('pending');
    });
  });

  describe('POST /files/:id/confirm', () => {
    it("returns 403 for another account's file", async () => {
      const ownerToken = await registerAndGetToken(app, 'creative');
      const otherToken = await registerAndGetToken(app, 'creative');
      const createResponse = await app.inject({
        method: 'POST',
        url: '/files/upload-url',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { purpose: 'portfolio', contentType: 'image/png' },
      });
      const fileId = createResponse.json().data.id as string;

      const response = await app.inject({
        method: 'POST',
        url: `/files/${fileId}/confirm`,
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('confirms the owning account file', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const createResponse = await app.inject({
        method: 'POST',
        url: '/files/upload-url',
        headers: { authorization: `Bearer ${token}` },
        payload: { purpose: 'portfolio', contentType: 'image/png' },
      });
      const fileId = createResponse.json().data.id as string;

      const response = await app.inject({
        method: 'POST',
        url: `/files/${fileId}/confirm`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data.status).toBe('confirmed');
    });
  });

  describe('GET /files', () => {
    it('paginates the account own files', async () => {
      const token = await registerAndGetToken(app, 'creative');
      for (let i = 0; i < 3; i += 1) {
        await app.inject({
          method: 'POST',
          url: '/files/upload-url',
          headers: { authorization: `Bearer ${token}` },
          payload: { purpose: 'portfolio', contentType: 'image/png' },
        });
      }

      const firstPage = await app.inject({
        method: 'GET',
        url: '/files?limit=2',
        headers: { authorization: `Bearer ${token}` },
      });
      const firstBody = firstPage.json().data;
      expect(firstBody.items).toHaveLength(2);
      expect(firstBody.nextCursor).toEqual(expect.any(String));

      const secondPage = await app.inject({
        method: 'GET',
        url: `/files?limit=2&cursor=${firstBody.nextCursor}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(secondPage.json().data.items).toHaveLength(1);
    });
  });

  describe('GET /files/:id/download-url', () => {
    it("returns 403 for another account's file", async () => {
      const ownerToken = await registerAndGetToken(app, 'creative');
      const otherToken = await registerAndGetToken(app, 'creative');
      const createResponse = await app.inject({
        method: 'POST',
        url: '/files/upload-url',
        headers: { authorization: `Bearer ${ownerToken}` },
        payload: { purpose: 'portfolio', contentType: 'image/png' },
      });
      const fileId = createResponse.json().data.id as string;

      const response = await app.inject({
        method: 'GET',
        url: `/files/${fileId}/download-url`,
        headers: { authorization: `Bearer ${otherToken}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it('returns a presigned download url for the owning account', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const createResponse = await app.inject({
        method: 'POST',
        url: '/files/upload-url',
        headers: { authorization: `Bearer ${token}` },
        payload: { purpose: 'portfolio', contentType: 'image/png' },
      });
      const fileId = createResponse.json().data.id as string;

      const response = await app.inject({
        method: 'GET',
        url: `/files/${fileId}/download-url`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data.downloadUrl).toEqual(expect.stringContaining('http'));
    });
  });
});
