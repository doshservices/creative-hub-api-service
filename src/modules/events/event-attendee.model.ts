import type { ObjectId } from 'mongodb';

export interface EventAttendeeDocument {
  _id: ObjectId;
  eventId: ObjectId;
  accountId: ObjectId;
  rsvpAt: Date;
}

export const eventAttendeeIndexes = [
  // One RSVP per account per event — the unique index is what actually prevents the race under
  // concurrent RSVPs; the service-level capacity/duplicate handling just gives a clean error in
  // the common case. Also serves the DELETE /:id/rsvp equality lookup directly.
  {
    key: { eventId: 1, accountId: 1 },
    name: 'eventId_accountId_unique',
    unique: true,
  },
] as const;
