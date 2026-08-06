import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app.js';

function uniqueEmail(): string {
  return `test-${randomUUID()}@example.com`;
}

async function registerAndGetToken(app: FastifyInstance): Promise<string> {
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
  return response.json().data.accessToken as string;
}

describe('notifications routes', () => {
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
    await app.mongo.db.collection('notificationPreferences').deleteMany({});
  });

  describe('GET /notifications/preferences', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'GET', url: '/notifications/preferences' });
      expect(response.statusCode).toBe(401);
    });

    it('returns all-enabled defaults without persisting anything', async () => {
      const token = await registerAndGetToken(app);

      const response = await app.inject({
        method: 'GET',
        url: '/notifications/preferences',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({
        emailJobOpportunities: true,
        emailPaymentNotifications: true,
        emailMessages: true,
        smsUrgentJobAlerts: true,
        smsPaymentConfirmations: true,
        inAppAllNotifications: true,
      });

      const count = await app.mongo.db.collection('notificationPreferences').countDocuments();
      expect(count).toBe(0);
    });
  });

  describe('PUT /notifications/preferences', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/notifications/preferences',
        payload: { emailMessages: false },
      });
      expect(response.statusCode).toBe(401);
    });

    it('strips an unknown field rather than persisting or rejecting it', async () => {
      const token = await registerAndGetToken(app);
      const response = await app.inject({
        method: 'PUT',
        url: '/notifications/preferences',
        headers: { authorization: `Bearer ${token}` },
        payload: { pushEverything: true },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).not.toHaveProperty('pushEverything');
    });

    it('rejects a non-boolean value for a known field', async () => {
      const token = await registerAndGetToken(app);
      const response = await app.inject({
        method: 'PUT',
        url: '/notifications/preferences',
        headers: { authorization: `Bearer ${token}` },
        payload: { emailMessages: 'yes' },
      });
      expect(response.statusCode).toBe(400);
    });

    it('updates only the provided fields, leaving the rest at their defaults', async () => {
      const token = await registerAndGetToken(app);

      const response = await app.inject({
        method: 'PUT',
        url: '/notifications/preferences',
        headers: { authorization: `Bearer ${token}` },
        payload: { emailMessages: false, smsUrgentJobAlerts: false },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({
        emailJobOpportunities: true,
        emailPaymentNotifications: true,
        emailMessages: false,
        smsUrgentJobAlerts: false,
        smsPaymentConfirmations: true,
        inAppAllNotifications: true,
      });
    });

    it('persists across requests and a second partial update does not clobber the first', async () => {
      const token = await registerAndGetToken(app);

      await app.inject({
        method: 'PUT',
        url: '/notifications/preferences',
        headers: { authorization: `Bearer ${token}` },
        payload: { emailMessages: false },
      });
      const secondResponse = await app.inject({
        method: 'PUT',
        url: '/notifications/preferences',
        headers: { authorization: `Bearer ${token}` },
        payload: { smsPaymentConfirmations: false },
      });

      expect(secondResponse.json().data).toMatchObject({
        emailMessages: false,
        smsPaymentConfirmations: false,
      });

      const getResponse = await app.inject({
        method: 'GET',
        url: '/notifications/preferences',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getResponse.json().data).toMatchObject({
        emailMessages: false,
        smsPaymentConfirmations: false,
      });

      const count = await app.mongo.db.collection('notificationPreferences').countDocuments();
      expect(count).toBe(1);
    });
  });
});
