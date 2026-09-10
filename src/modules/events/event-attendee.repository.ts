import type { ClientSession, Collection, Db } from 'mongodb';
import { MongoServerError, ObjectId } from 'mongodb';
import { eventAttendeeIndexes, type EventAttendeeDocument } from './event-attendee.model.js';
import type { EventAttendeeDTO } from './dto.js';

function toDTO(doc: EventAttendeeDocument): EventAttendeeDTO {
  return {
    id: doc._id.toHexString(),
    eventId: doc.eventId.toHexString(),
    accountId: doc.accountId.toHexString(),
    rsvpAt: doc.rsvpAt,
  };
}

// A duplicate (eventId, accountId) hit the unique index — the account has already RSVP'd to
// this event. See the money-and-ledger-adjacent pattern in wallet's DuplicateIdempotencyKeyError
// and hiring's unique-application-index comment: the index is what actually prevents the race,
// this error just gives the service a clean signal to resolve into a domain error.
export class DuplicateRsvpError extends Error {}

export class EventAttendeeRepository {
  private readonly collection: Collection<EventAttendeeDocument>;

  constructor(db: Db) {
    this.collection = db.collection<EventAttendeeDocument>('eventAttendees');
  }

  async createIndexes(): Promise<void> {
    for (const index of eventAttendeeIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async createRsvp(
    eventId: string,
    accountId: string,
    session: ClientSession,
  ): Promise<EventAttendeeDTO> {
    const doc: EventAttendeeDocument = {
      _id: new ObjectId(),
      eventId: new ObjectId(eventId),
      accountId: new ObjectId(accountId),
      rsvpAt: new Date(),
    };
    try {
      await this.collection.insertOne(doc, { session });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new DuplicateRsvpError(`Account ${accountId} has already RSVP'd to event ${eventId}`);
      }
      throw error;
    }
    return toDTO(doc);
  }

  // Returns whether a document was actually removed, so the caller can decide whether the
  // event's attendeeCount needs to move at all — cancelling a non-existent RSVP is a no-op, not
  // an error.
  async deleteRsvp(eventId: string, accountId: string, session: ClientSession): Promise<boolean> {
    const result = await this.collection.deleteOne(
      { eventId: new ObjectId(eventId), accountId: new ObjectId(accountId) },
      { session },
    );
    return result.deletedCount > 0;
  }
}
