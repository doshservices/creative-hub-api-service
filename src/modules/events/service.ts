import type { ClientSession } from 'mongodb';
import { ConflictError, NotFoundError } from '../../common/errors.js';
import { DuplicateRsvpError } from './event-attendee.repository.js';
import type { EventDTO, EventPage } from './dto.js';
import type { EventType } from './model.js';

export interface CreateEventInput {
  title: string;
  description: string;
  eventType: EventType;
  category: string;
  location: string;
  startsAt: Date;
  capacity: number;
}

export interface PageParams {
  limit: number;
  cursor?: string;
}

export interface BrowseEventsParams extends PageParams {
  search?: string;
  location?: string;
  eventType?: EventType;
}

export interface EventRepositoryPort {
  create(input: CreateEventInput & { organizerAccountId: string }): Promise<EventDTO>;
  findById(id: string): Promise<EventDTO | null>;
  listPublic(
    filter: { search?: string; location?: string; eventType?: EventType },
    params: PageParams,
  ): Promise<EventPage>;
  listByOrganizer(organizerAccountId: string, params: PageParams): Promise<EventPage>;
  incrementAttendeeCount(id: string, session: ClientSession): Promise<EventDTO | null>;
  decrementAttendeeCount(id: string, session: ClientSession): Promise<EventDTO | null>;
}

export interface EventAttendeeRepositoryPort {
  createRsvp(eventId: string, accountId: string, session: ClientSession): Promise<unknown>;
  deleteRsvp(eventId: string, accountId: string, session: ClientSession): Promise<boolean>;
}

// Local to this module, mirroring wallet's TransactionRunnerPort/createTransactionRunner shape
// (see wallet/service.ts and wallet/index.ts) rather than importing wallet's — cross-module
// imports only go through a module's index.ts, and this port is small enough not to be worth
// sharing.
export interface TransactionRunnerPort {
  withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T>;
}

export class EventService {
  constructor(
    private readonly events: EventRepositoryPort,
    private readonly attendees: EventAttendeeRepositoryPort,
    private readonly transactions: TransactionRunnerPort,
  ) {}

  async create(organizerAccountId: string, input: CreateEventInput): Promise<EventDTO> {
    return this.events.create({ ...input, organizerAccountId });
  }

  async getById(eventId: string): Promise<EventDTO> {
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }
    return event;
  }

  async browse(params: BrowseEventsParams): Promise<EventPage> {
    const { limit, cursor, ...filter } = params;
    return this.events.listPublic(filter, { limit, ...(cursor ? { cursor } : {}) });
  }

  async listMine(organizerAccountId: string, params: PageParams): Promise<EventPage> {
    return this.events.listByOrganizer(organizerAccountId, params);
  }

  // Capacity-safe under concurrency, no read-then-write: the attendee doc is inserted first (a
  // duplicate throws DuplicateRsvpError off the unique index), then the same transaction runs an
  // atomic capacity-guarded increment. If the increment finds the event already full it throws,
  // which aborts the transaction and rolls back the attendee insert too — see
  // EventRepository.incrementAttendeeCount and the mongo-data-layer skill's transactions section.
  async rsvp(accountId: string, eventId: string): Promise<EventDTO> {
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    try {
      return await this.transactions.withTransaction(async (session) => {
        await this.attendees.createRsvp(eventId, accountId, session);
        const updated = await this.events.incrementAttendeeCount(eventId, session);
        if (!updated) {
          throw new ConflictError('This event is at capacity');
        }
        return updated;
      });
    } catch (error) {
      if (error instanceof DuplicateRsvpError) {
        throw new ConflictError("You have already RSVP'd to this event");
      }
      throw error;
    }
  }

  // Mirrors rsvp() in reverse. Cancelling an RSVP that doesn't exist is a clean no-op (not a
  // 404/crash) — deleteRsvp reports whether it actually removed a document, and the attendeeCount
  // decrement only runs when it did, so a repeated cancel can't under-count.
  async cancelRsvp(accountId: string, eventId: string): Promise<EventDTO> {
    const event = await this.events.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    return this.transactions.withTransaction(async (session) => {
      const removed = await this.attendees.deleteRsvp(eventId, accountId, session);
      if (!removed) {
        return event;
      }
      const updated = await this.events.decrementAttendeeCount(eventId, session);
      return updated ?? event;
    });
  }
}
