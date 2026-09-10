import type { ClientSession, Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import { eventIndexes, type EventDocument, type EventType } from './model.js';
import type { EventDTO, EventPage } from './dto.js';

export interface CreateEventData {
  organizerAccountId: string;
  title: string;
  description: string;
  eventType: EventType;
  category: string;
  location: string;
  startsAt: Date;
  capacity: number;
}

export interface BrowseEventsFilter {
  search?: string;
  location?: string;
  eventType?: EventType;
}

const EVENT_PROJECTION = {
  organizerAccountId: 1,
  title: 1,
  description: 1,
  eventType: 1,
  category: 1,
  location: 1,
  startsAt: 1,
  capacity: 1,
  attendeeCount: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toDTO(doc: EventDocument): EventDTO {
  return {
    id: doc._id.toHexString(),
    organizerAccountId: doc.organizerAccountId.toHexString(),
    title: doc.title,
    description: doc.description,
    eventType: doc.eventType,
    category: doc.category,
    location: doc.location,
    startsAt: doc.startsAt,
    capacity: doc.capacity,
    attendeeCount: doc.attendeeCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// Escapes user input before it's interpolated into a $regex filter — without this, a client
// could supply regex metacharacters (unbounded quantifiers, alternation) as a search term.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class EventRepository {
  private readonly collection: Collection<EventDocument>;

  constructor(db: Db) {
    this.collection = db.collection<EventDocument>('events');
  }

  async createIndexes(): Promise<void> {
    for (const index of eventIndexes) {
      await this.collection.createIndex(index.key, { name: index.name });
    }
  }

  async create(input: CreateEventData): Promise<EventDTO> {
    const now = new Date();
    const doc: EventDocument = {
      _id: new ObjectId(),
      organizerAccountId: new ObjectId(input.organizerAccountId),
      title: input.title,
      description: input.description,
      eventType: input.eventType,
      category: input.category,
      location: input.location,
      startsAt: input.startsAt,
      capacity: input.capacity,
      attendeeCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.collection.insertOne(doc);
    return toDTO(doc);
  }

  async findById(id: string): Promise<EventDTO | null> {
    const doc = await this.collection.findOne(
      { _id: new ObjectId(id) },
      { projection: EVENT_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async listPublic(
    filter: BrowseEventsFilter,
    params: { limit: number; cursor?: string },
  ): Promise<EventPage> {
    const baseFilter: Filter<EventDocument> = {};
    if (filter.eventType) {
      baseFilter.eventType = filter.eventType;
    }
    if (filter.location) {
      baseFilter.location = { $regex: escapeRegExp(filter.location), $options: 'i' };
    }
    if (filter.search) {
      const pattern = escapeRegExp(filter.search);
      baseFilter.$or = [
        { title: { $regex: pattern, $options: 'i' } },
        { description: { $regex: pattern, $options: 'i' } },
      ];
    }
    return this.listByFilter(baseFilter, params);
  }

  async listByOrganizer(
    organizerAccountId: string,
    params: { limit: number; cursor?: string },
  ): Promise<EventPage> {
    return this.listByFilter({ organizerAccountId: new ObjectId(organizerAccountId) }, params);
  }

  // Capacity-safe increment: only succeeds while attendeeCount is still below capacity, so the
  // check-and-increment is one atomic operation with no read-then-write race window. Must run
  // inside the same transaction as the attendee-doc insert it accompanies — see the
  // mongo-data-layer skill's transactions section and EventService.rsvp.
  async incrementAttendeeCount(id: string, session: ClientSession): Promise<EventDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id), $expr: { $lt: ['$attendeeCount', '$capacity'] } },
      { $inc: { attendeeCount: 1 }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after', projection: EVENT_PROJECTION, session },
    );
    return result ? toDTO(result) : null;
  }

  // Mirror of incrementAttendeeCount for RSVP cancellation, floored at 0 via the $gt guard so a
  // stray extra cancel can never drive the count negative.
  async decrementAttendeeCount(id: string, session: ClientSession): Promise<EventDTO | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id), attendeeCount: { $gt: 0 } },
      { $inc: { attendeeCount: -1 }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after', projection: EVENT_PROJECTION, session },
    );
    return result ? toDTO(result) : null;
  }

  private async listByFilter(
    baseFilter: Filter<EventDocument>,
    { limit, cursor }: { limit: number; cursor?: string },
  ): Promise<EventPage> {
    const filter: Filter<EventDocument> = cursor
      ? { ...baseFilter, _id: { $lt: new ObjectId(cursor) } }
      : baseFilter;

    const docs = await this.collection
      .find(filter, { projection: EVENT_PROJECTION })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map(toDTO);
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last ? last.id : null };
  }
}
