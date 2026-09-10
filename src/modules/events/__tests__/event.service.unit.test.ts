import { randomUUID } from 'node:crypto';
import type { ClientSession } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../../../common/errors.js';
import { DuplicateRsvpError } from '../event-attendee.repository.js';
import { EventService } from '../service.js';
import type {
  EventAttendeeRepositoryPort,
  EventRepositoryPort,
  TransactionRunnerPort,
} from '../service.js';
import type { EventDTO } from '../dto.js';

// A small in-memory fake of both repositories, backing the exact atomic-guard semantics the
// real Mongo repositories implement (capacity-guarded findOneAndUpdate + a unique-index-backed
// duplicate check) — this exercises EventService's real business logic (capacity race, duplicate
// RSVP, idempotent cancel) without a real Mongo instance, per the test-suite skill's unit-test
// boundary. The transaction runner snapshots state before running the callback and restores it
// on throw, mirroring a real Mongo session's rollback — this is what actually proves the
// capacity-full case rolls back the attendee insert too, not just that it throws.
function buildFakes() {
  let events = new Map<string, EventDTO>();
  let attendees = new Set<string>();

  const eventRepository: EventRepositoryPort = {
    create(input) {
      const event: EventDTO = {
        id: randomUUID(),
        attendeeCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...input,
      };
      events.set(event.id, event);
      return Promise.resolve(event);
    },
    findById(id) {
      return Promise.resolve(events.get(id) ?? null);
    },
    listPublic() {
      return Promise.resolve({ items: [...events.values()], nextCursor: null });
    },
    listByOrganizer(organizerAccountId) {
      return Promise.resolve({
        items: [...events.values()].filter((e) => e.organizerAccountId === organizerAccountId),
        nextCursor: null,
      });
    },
    incrementAttendeeCount(id) {
      const event = events.get(id);
      if (!event || event.attendeeCount >= event.capacity) {
        return Promise.resolve(null);
      }
      const updated = { ...event, attendeeCount: event.attendeeCount + 1, updatedAt: new Date() };
      events.set(id, updated);
      return Promise.resolve(updated);
    },
    decrementAttendeeCount(id) {
      const event = events.get(id);
      if (!event || event.attendeeCount <= 0) {
        return Promise.resolve(null);
      }
      const updated = { ...event, attendeeCount: event.attendeeCount - 1, updatedAt: new Date() };
      events.set(id, updated);
      return Promise.resolve(updated);
    },
  };

  const attendeeRepository: EventAttendeeRepositoryPort = {
    createRsvp(eventId, accountId) {
      const key = `${eventId}:${accountId}`;
      if (attendees.has(key)) {
        return Promise.reject(new DuplicateRsvpError(key));
      }
      attendees.add(key);
      return Promise.resolve({ id: randomUUID(), eventId, accountId, rsvpAt: new Date() });
    },
    deleteRsvp(eventId, accountId) {
      const key = `${eventId}:${accountId}`;
      const existed = attendees.has(key);
      attendees.delete(key);
      return Promise.resolve(existed);
    },
  };

  const transactionRunner: TransactionRunnerPort = {
    async withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
      const eventsSnapshot = new Map(events);
      const attendeesSnapshot = new Set(attendees);
      try {
        return await fn({} as ClientSession);
      } catch (error) {
        events = eventsSnapshot;
        attendees = attendeesSnapshot;
        throw error;
      }
    },
  };

  return { eventRepository, attendeeRepository, transactionRunner };
}

function buildService() {
  const fakes = buildFakes();
  const service = new EventService(
    fakes.eventRepository,
    fakes.attendeeRepository,
    fakes.transactionRunner,
  );
  return { service, ...fakes };
}

const minimalInput = {
  title: 'Open Casting Call',
  description: 'Looking for lead roles',
  eventType: 'casting_call' as const,
  category: 'Film',
  location: 'Lagos, Nigeria',
  startsAt: new Date('2026-10-01T10:00:00Z'),
  capacity: 1,
};

describe('EventService.create', () => {
  it('creates an event owned by the calling organizer', async () => {
    const { service, eventRepository } = buildService();

    const event = await service.create('organizer-1', minimalInput);

    expect(event.organizerAccountId).toBe('organizer-1');
    expect(event.attendeeCount).toBe(0);
    expect(await eventRepository.findById(event.id)).toMatchObject({ title: minimalInput.title });
  });
});

describe('EventService.getById', () => {
  it('throws NotFoundError when the event does not exist', async () => {
    const { service } = buildService();

    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('EventService.rsvp', () => {
  it('increments attendeeCount on a successful RSVP', async () => {
    const { service } = buildService();
    const event = await service.create('organizer-1', { ...minimalInput, capacity: 5 });

    const updated = await service.rsvp('attendee-1', event.id);

    expect(updated.attendeeCount).toBe(1);
  });

  it('rejects a duplicate RSVP from the same account', async () => {
    const { service } = buildService();
    const event = await service.create('organizer-1', { ...minimalInput, capacity: 5 });
    await service.rsvp('attendee-1', event.id);

    await expect(service.rsvp('attendee-1', event.id)).rejects.toBeInstanceOf(ConflictError);

    const current = await service.getById(event.id);
    expect(current.attendeeCount).toBe(1);
  });

  it('rejects an RSVP once the event is at capacity, rolling back the attendee insert', async () => {
    const { service } = buildService();
    const event = await service.create('organizer-1', { ...minimalInput, capacity: 1 });
    await service.rsvp('attendee-1', event.id);

    await expect(service.rsvp('attendee-2', event.id)).rejects.toBeInstanceOf(ConflictError);

    const current = await service.getById(event.id);
    expect(current.attendeeCount).toBe(1);
    // The rejected RSVP's attendee row must have been rolled back, not left dangling — proven by
    // being able to successfully RSVP again once a spot frees up.
    await service.cancelRsvp('attendee-1', event.id);
    const afterCancel = await service.rsvp('attendee-2', event.id);
    expect(afterCancel.attendeeCount).toBe(1);
  });

  it('throws NotFoundError when the event does not exist', async () => {
    const { service } = buildService();

    await expect(service.rsvp('attendee-1', 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('EventService.cancelRsvp', () => {
  it('decrements attendeeCount when the account had RSVP\'d', async () => {
    const { service } = buildService();
    const event = await service.create('organizer-1', { ...minimalInput, capacity: 5 });
    await service.rsvp('attendee-1', event.id);

    const updated = await service.cancelRsvp('attendee-1', event.id);

    expect(updated.attendeeCount).toBe(0);
  });

  it('is a clean no-op when the account never RSVP\'d, not an error', async () => {
    const { service } = buildService();
    const event = await service.create('organizer-1', { ...minimalInput, capacity: 5 });

    const result = await service.cancelRsvp('never-rsvpd', event.id);

    expect(result.attendeeCount).toBe(0);
  });

  it('throws NotFoundError when the event does not exist', async () => {
    const { service } = buildService();

    await expect(service.cancelRsvp('attendee-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
