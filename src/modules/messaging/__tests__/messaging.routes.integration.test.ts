import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../../app.js';
import type { AccountType } from '../../auth/model.js';

function uniqueEmail(): string {
  return `test-${randomUUID()}@example.com`;
}

async function registerAccount(app: FastifyInstance, accountType: AccountType = 'client') {
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
  const data = response.json().data;
  return { accessToken: data.accessToken as string };
}

async function whoAmI(app: FastifyInstance, token: string): Promise<string> {
  const response = await app.inject({
    method: 'GET',
    url: '/auth/me',
    headers: { authorization: `Bearer ${token}` },
  });
  return response.json().data.id as string;
}

async function sendMessage(
  app: FastifyInstance,
  senderToken: string,
  recipientAccountId: string,
  content = 'Hello there',
) {
  return app.inject({
    method: 'POST',
    url: '/messaging/messages',
    headers: { authorization: `Bearer ${senderToken}` },
    payload: { recipientAccountId, content },
  });
}

describe('messaging routes', () => {
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
    await app.mongo.db.collection('conversations').deleteMany({});
    await app.mongo.db.collection('messages').deleteMany({});
  });

  describe('POST /messaging/messages', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/messaging/messages',
        payload: { recipientAccountId: '000000000000000000000000', content: 'hi' },
      });
      expect(response.statusCode).toBe(401);
    });

    it('rejects messaging yourself', async () => {
      const a = await registerAccount(app);
      const aId = await whoAmI(app, a.accessToken);

      const response = await sendMessage(app, a.accessToken, aId);
      expect(response.statusCode).toBe(400);
    });

    it('rejects messaging an account that does not exist', async () => {
      const a = await registerAccount(app);
      const response = await sendMessage(app, a.accessToken, '000000000000000000000000');
      expect(response.statusCode).toBe(404);
    });

    it('sends a message and creates a conversation', async () => {
      const a = await registerAccount(app, 'client');
      const b = await registerAccount(app, 'creative');
      const bId = await whoAmI(app, b.accessToken);

      const response = await sendMessage(app, a.accessToken, bId, 'Can we discuss availability?');

      expect(response.statusCode).toBe(201);
      expect(response.json().data.content).toBe('Can we discuss availability?');

      const conversationCount = await app.mongo.db.collection('conversations').countDocuments();
      expect(conversationCount).toBe(1);
    });

    it('reuses the same conversation for repeated messages between the same pair', async () => {
      const a = await registerAccount(app);
      const b = await registerAccount(app);
      const bId = await whoAmI(app, b.accessToken);
      const aId = await whoAmI(app, a.accessToken);

      await sendMessage(app, a.accessToken, bId, 'First');
      await sendMessage(app, b.accessToken, aId, 'Reply'); // reversed sender/recipient, same pair

      const conversationCount = await app.mongo.db.collection('conversations').countDocuments();
      expect(conversationCount).toBe(1);

      const messageCount = await app.mongo.db.collection('messages').countDocuments();
      expect(messageCount).toBe(2);
    });

    it('increments the recipient unread count, not the sender', async () => {
      const a = await registerAccount(app);
      const b = await registerAccount(app);
      const bId = await whoAmI(app, b.accessToken);

      await sendMessage(app, a.accessToken, bId, 'Hi');

      const aConversations = await app.inject({
        method: 'GET',
        url: '/messaging/conversations',
        headers: { authorization: `Bearer ${a.accessToken}` },
      });
      const bConversations = await app.inject({
        method: 'GET',
        url: '/messaging/conversations',
        headers: { authorization: `Bearer ${b.accessToken}` },
      });

      expect(aConversations.json().data.items[0].unreadCount).toBe(0);
      expect(bConversations.json().data.items[0].unreadCount).toBe(1);
    });
  });

  describe('GET /messaging/conversations', () => {
    it('returns an empty page with no conversations', async () => {
      const a = await registerAccount(app);
      const response = await app.inject({
        method: 'GET',
        url: '/messaging/conversations',
        headers: { authorization: `Bearer ${a.accessToken}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({ items: [], nextCursor: null });
    });

    it('paginates conversations most-recently-active first', async () => {
      const me = await registerAccount(app);
      for (let i = 0; i < 3; i += 1) {
        const other = await registerAccount(app);
        const otherId = await whoAmI(app, other.accessToken);
        await sendMessage(app, me.accessToken, otherId, `Message ${i}`);
      }

      const firstPage = await app.inject({
        method: 'GET',
        url: '/messaging/conversations?limit=2',
        headers: { authorization: `Bearer ${me.accessToken}` },
      });
      const firstBody = firstPage.json().data;
      expect(firstBody.items).toHaveLength(2);
      expect(firstBody.nextCursor).toEqual(expect.any(String));

      const secondPage = await app.inject({
        method: 'GET',
        url: `/messaging/conversations?limit=2&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
        headers: { authorization: `Bearer ${me.accessToken}` },
      });
      const secondBody = secondPage.json().data;
      expect(secondBody.items).toHaveLength(1);
      expect(secondBody.nextCursor).toBeNull();

      const allIds = [...firstBody.items, ...secondBody.items].map(
        (item: { id: string }) => item.id,
      );
      expect(new Set(allIds).size).toBe(3);
    });
  });

  describe('GET /messaging/conversations/:id/messages', () => {
    it('rejects a non-participant', async () => {
      const a = await registerAccount(app);
      const b = await registerAccount(app);
      const bId = await whoAmI(app, b.accessToken);
      const sendResponse = await sendMessage(app, a.accessToken, bId);
      const conversationId = sendResponse.json().data.conversationId;

      const outsider = await registerAccount(app);
      const response = await app.inject({
        method: 'GET',
        url: `/messaging/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${outsider.accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it('paginates messages within a conversation', async () => {
      const a = await registerAccount(app);
      const b = await registerAccount(app);
      const bId = await whoAmI(app, b.accessToken);

      let conversationId = '';
      for (let i = 0; i < 3; i += 1) {
        const response = await sendMessage(app, a.accessToken, bId, `Message ${i}`);
        conversationId = response.json().data.conversationId;
      }

      const firstPage = await app.inject({
        method: 'GET',
        url: `/messaging/conversations/${conversationId}/messages?limit=2`,
        headers: { authorization: `Bearer ${a.accessToken}` },
      });
      const firstBody = firstPage.json().data;
      expect(firstBody.items).toHaveLength(2);
      expect(firstBody.nextCursor).toEqual(expect.any(String));

      const secondPage = await app.inject({
        method: 'GET',
        url: `/messaging/conversations/${conversationId}/messages?limit=2&cursor=${firstBody.nextCursor}`,
        headers: { authorization: `Bearer ${a.accessToken}` },
      });
      const secondBody = secondPage.json().data;
      expect(secondBody.items).toHaveLength(1);
      expect(secondBody.nextCursor).toBeNull();
    });
  });

  describe('POST /messaging/conversations/:id/read', () => {
    it('rejects a non-participant', async () => {
      const a = await registerAccount(app);
      const b = await registerAccount(app);
      const bId = await whoAmI(app, b.accessToken);
      const sendResponse = await sendMessage(app, a.accessToken, bId);
      const conversationId = sendResponse.json().data.conversationId;

      const outsider = await registerAccount(app);
      const response = await app.inject({
        method: 'POST',
        url: `/messaging/conversations/${conversationId}/read`,
        headers: { authorization: `Bearer ${outsider.accessToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it("resets the caller's unread count to zero", async () => {
      const a = await registerAccount(app);
      const b = await registerAccount(app);
      const bId = await whoAmI(app, b.accessToken);
      const sendResponse = await sendMessage(app, a.accessToken, bId);
      const conversationId = sendResponse.json().data.conversationId;

      const beforeRead = await app.inject({
        method: 'GET',
        url: '/messaging/conversations',
        headers: { authorization: `Bearer ${b.accessToken}` },
      });
      expect(beforeRead.json().data.items[0].unreadCount).toBe(1);

      const readResponse = await app.inject({
        method: 'POST',
        url: `/messaging/conversations/${conversationId}/read`,
        headers: { authorization: `Bearer ${b.accessToken}` },
      });
      expect(readResponse.statusCode).toBe(204);

      const afterRead = await app.inject({
        method: 'GET',
        url: '/messaging/conversations',
        headers: { authorization: `Bearer ${b.accessToken}` },
      });
      expect(afterRead.json().data.items[0].unreadCount).toBe(0);
    });
  });
});
