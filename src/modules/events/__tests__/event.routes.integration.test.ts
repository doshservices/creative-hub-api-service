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

const minimalEvent = {
  title: 'Open Casting Call',
  description: 'Looking for lead roles in an upcoming feature film.',
  eventType: 'casting_call',
  category: 'Film',
  location: 'Lagos, Nigeria',
  startsAt: '2026-10-01T10:00:00.000Z',
  capacity: 2,
};

async function createEvent(app: FastifyInstance, token: string, overrides = {}) {
  return app.inject({
    method: 'POST',
    url: '/events',
    headers: { authorization: `Bearer ${token}` },
    payload: { ...minimalEvent, ...overrides },
  });
}

describe('events routes', () => {
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
    await app.mongo.db.collection('events').deleteMany({});
    await app.mongo.db.collection('eventAttendees').deleteMany({});
  });

  describe('POST /events', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'POST', url: '/events', payload: minimalEvent });
      expect(response.statusCode).toBe(401);
    });

    it('rejects an account without events:write', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const response = await createEvent(app, token);
      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ success: false, error: 'FORBIDDEN' });
    });

    it('rejects an invalid body', async () => {
      const token = await registerAndGetToken(app, 'client');
      const response = await createEvent(app, token, { capacity: 0 });
      expect(response.statusCode).toBe(400);
    });

    it('creates an event owned by the calling account, ignoring a client-supplied organizerAccountId', async () => {
      const token = await registerAndGetToken(app, 'client');
      const response = await createEvent(app, token, { organizerAccountId: '000000000000000000000000' });

      expect(response.statusCode).toBe(201);
      const body = response.json().data;
      expect(body.title).toBe(minimalEvent.title);
      expect(body.attendeeCount).toBe(0);
      expect(body.organizerAccountId).not.toBe('000000000000000000000000');
    });
  });

  describe('GET /events (public browse)', () => {
    it('rejects an unauthenticated request', async () => {
      const response = await app.inject({ method: 'GET', url: '/events' });
      expect(response.statusCode).toBe(401);
    });

    it('returns an empty page when there are no events', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'GET',
        url: '/events',
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual({ items: [], nextCursor: null });
    });

    it('paginates with nextCursor across pages', async () => {
      const organizerToken = await registerAndGetToken(app, 'client');
      for (let i = 0; i < 3; i += 1) {
        await createEvent(app, organizerToken, { title: `Event ${i}` });
      }

      const browseToken = await registerAndGetToken(app, 'creative');
      const firstPage = await app.inject({
        method: 'GET',
        url: '/events?limit=2',
        headers: { authorization: `Bearer ${browseToken}` },
      });
      expect(firstPage.statusCode).toBe(200);
      const firstBody = firstPage.json().data;
      expect(firstBody.items).toHaveLength(2);
      expect(firstBody.nextCursor).toEqual(expect.any(String));

      const secondPage = await app.inject({
        method: 'GET',
        url: `/events?limit=2&cursor=${firstBody.nextCursor}`,
        headers: { authorization: `Bearer ${browseToken}` },
      });
      expect(secondPage.statusCode).toBe(200);
      const secondBody = secondPage.json().data;
      expect(secondBody.items).toHaveLength(1);
      expect(secondBody.nextCursor).toBeNull();
    });

    it('filters by eventType', async () => {
      const organizerToken = await registerAndGetToken(app, 'client');
      await createEvent(app, organizerToken, { title: 'A Casting Call', eventType: 'casting_call' });
      await createEvent(app, organizerToken, { title: 'A Meetup', eventType: 'meetup' });

      const browseToken = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'GET',
        url: '/events?eventType=meetup',
        headers: { authorization: `Bearer ${browseToken}` },
      });

      expect(response.statusCode).toBe(200);
      const items = response.json().data.items;
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('A Meetup');
    });

    it('filters by a case-insensitive search on title/description', async () => {
      const organizerToken = await registerAndGetToken(app, 'client');
      await createEvent(app, organizerToken, { title: 'Dance Crew Auditions' });
      await createEvent(app, organizerToken, { title: 'Photography Meetup' });

      const browseToken = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'GET',
        url: '/events?search=dance',
        headers: { authorization: `Bearer ${browseToken}` },
      });

      expect(response.statusCode).toBe(200);
      const items = response.json().data.items;
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Dance Crew Auditions');
    });
  });

  describe('GET /events/mine', () => {
    it('rejects an account without events:write', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'GET',
        url: '/events/mine',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(403);
    });

    it("returns only the caller's own events", async () => {
      const ownerToken = await registerAndGetToken(app, 'client');
      const otherToken = await registerAndGetToken(app, 'client');
      await createEvent(app, ownerToken, { title: 'Owner event' });
      await createEvent(app, otherToken, { title: 'Other event' });

      const response = await app.inject({
        method: 'GET',
        url: '/events/mine',
        headers: { authorization: `Bearer ${ownerToken}` },
      });

      expect(response.statusCode).toBe(200);
      const items = response.json().data.items;
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Owner event');
    });
  });

  describe('GET /events/:id', () => {
    it('returns 404 for an event that does not exist', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'GET',
        url: '/events/000000000000000000000000',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(404);
    });

    it('returns a single event by id', async () => {
      const organizerToken = await registerAndGetToken(app, 'client');
      const created = await createEvent(app, organizerToken);
      const browseToken = await registerAndGetToken(app, 'creative');

      const response = await app.inject({
        method: 'GET',
        url: `/events/${created.json().data.id}`,
        headers: { authorization: `Bearer ${browseToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.title).toBe(minimalEvent.title);
    });
  });

  describe('POST /events/:id/rsvp', () => {
    it('rejects an unauthenticated request', async () => {
      const organizerToken = await registerAndGetToken(app, 'client');
      const created = await createEvent(app, organizerToken);

      const response = await app.inject({
        method: 'POST',
        url: `/events/${created.json().data.id}/rsvp`,
      });
      expect(response.statusCode).toBe(401);
    });

    it('does not require events:write — any authenticated account can RSVP', async () => {
      const organizerToken = await registerAndGetToken(app, 'client');
      const created = await createEvent(app, organizerToken);
      const attendeeToken = await registerAndGetToken(app, 'creative');

      const response = await app.inject({
        method: 'POST',
        url: `/events/${created.json().data.id}/rsvp`,
        headers: { authorization: `Bearer ${attendeeToken}` },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().data.attendeeCount).toBe(1);
    });

    it('returns 404 for an event that does not exist', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'POST',
        url: '/events/000000000000000000000000/rsvp',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(404);
    });

    it('rejects a duplicate RSVP from the same account with a clean conflict, not a crash', async () => {
      const organizerToken = await registerAndGetToken(app, 'client');
      const created = await createEvent(app, organizerToken);
      const attendeeToken = await registerAndGetToken(app, 'creative');

      await app.inject({
        method: 'POST',
        url: `/events/${created.json().data.id}/rsvp`,
        headers: { authorization: `Bearer ${attendeeToken}` },
      });
      const response = await app.inject({
        method: 'POST',
        url: `/events/${created.json().data.id}/rsvp`,
        headers: { authorization: `Bearer ${attendeeToken}` },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ success: false, error: 'CONFLICT' });

      const eventDoc = await app.mongo.db
        .collection('events')
        .findOne({ _id: new ObjectId(created.json().data.id) });
      expect(eventDoc?.attendeeCount).toBe(1);
    });

    it('rejects RSVPs once the event is at capacity, under concurrent requests', async () => {
      const organizerToken = await registerAndGetToken(app, 'client');
      const created = await createEvent(app, organizerToken, { capacity: 1 });
      const eventId = created.json().data.id;

      const attendeeTokens = await Promise.all([
        registerAndGetToken(app, 'creative'),
        registerAndGetToken(app, 'creative'),
        registerAndGetToken(app, 'creative'),
      ]);

      const responses = await Promise.all(
        attendeeTokens.map((token) =>
          app.inject({
            method: 'POST',
            url: `/events/${eventId}/rsvp`,
            headers: { authorization: `Bearer ${token}` },
          }),
        ),
      );

      const succeeded = responses.filter((r) => r.statusCode === 201);
      const rejected = responses.filter((r) => r.statusCode === 409);
      expect(succeeded).toHaveLength(1);
      expect(rejected).toHaveLength(2);
      for (const response of rejected) {
        expect(response.json()).toMatchObject({ success: false, error: 'CONFLICT' });
      }

      const attendeeCount = await app.mongo.db
        .collection('eventAttendees')
        .countDocuments({ eventId: new ObjectId(eventId) });
      expect(attendeeCount).toBe(1);
    });
  });

  describe('DELETE /events/:id/rsvp', () => {
    it('rejects an unauthenticated request', async () => {
      const organizerToken = await registerAndGetToken(app, 'client');
      const created = await createEvent(app, organizerToken);

      const response = await app.inject({
        method: 'DELETE',
        url: `/events/${created.json().data.id}/rsvp`,
      });
      expect(response.statusCode).toBe(401);
    });

    it('decrements attendeeCount when cancelling an existing RSVP', async () => {
      const organizerToken = await registerAndGetToken(app, 'client');
      const created = await createEvent(app, organizerToken);
      const eventId = created.json().data.id;
      const attendeeToken = await registerAndGetToken(app, 'creative');

      await app.inject({
        method: 'POST',
        url: `/events/${eventId}/rsvp`,
        headers: { authorization: `Bearer ${attendeeToken}` },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/events/${eventId}/rsvp`,
        headers: { authorization: `Bearer ${attendeeToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.attendeeCount).toBe(0);
    });

    it('is a clean no-op (not a crash) when cancelling an RSVP that never existed', async () => {
      const organizerToken = await registerAndGetToken(app, 'client');
      const created = await createEvent(app, organizerToken);
      const eventId = created.json().data.id;
      const neverRsvpdToken = await registerAndGetToken(app, 'creative');

      const response = await app.inject({
        method: 'DELETE',
        url: `/events/${eventId}/rsvp`,
        headers: { authorization: `Bearer ${neverRsvpdToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.attendeeCount).toBe(0);
    });

    it('returns 404 for an event that does not exist', async () => {
      const token = await registerAndGetToken(app, 'creative');
      const response = await app.inject({
        method: 'DELETE',
        url: '/events/000000000000000000000000/rsvp',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(404);
    });

    it('frees a capacity slot so another account can RSVP after a cancellation', async () => {
      const organizerToken = await registerAndGetToken(app, 'client');
      const created = await createEvent(app, organizerToken, { capacity: 1 });
      const eventId = created.json().data.id;
      const firstAttendee = await registerAndGetToken(app, 'creative');
      const secondAttendee = await registerAndGetToken(app, 'creative');

      await app.inject({
        method: 'POST',
        url: `/events/${eventId}/rsvp`,
        headers: { authorization: `Bearer ${firstAttendee}` },
      });
      const blocked = await app.inject({
        method: 'POST',
        url: `/events/${eventId}/rsvp`,
        headers: { authorization: `Bearer ${secondAttendee}` },
      });
      expect(blocked.statusCode).toBe(409);

      await app.inject({
        method: 'DELETE',
        url: `/events/${eventId}/rsvp`,
        headers: { authorization: `Bearer ${firstAttendee}` },
      });
      const afterCancel = await app.inject({
        method: 'POST',
        url: `/events/${eventId}/rsvp`,
        headers: { authorization: `Bearer ${secondAttendee}` },
      });

      expect(afterCancel.statusCode).toBe(201);
      expect(afterCancel.json().data.attendeeCount).toBe(1);
    });
  });
});
