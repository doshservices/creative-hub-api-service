import type { ObjectId } from 'mongodb';

export type EventType = 'casting_call' | 'meetup' | 'virtual_event';

export interface EventDocument {
  _id: ObjectId;
  organizerAccountId: ObjectId;
  title: string;
  description: string;
  eventType: EventType;
  category: string;
  location: string;
  startsAt: Date;
  capacity: number;
  attendeeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Sorted/paginated by _id descending, same reasoning as listings/hiring: ObjectIds are unique
// and already time-ordered, so no separate tie-breaking is needed for a createdAt-only cursor.
// `search`/`location` are served via a case-insensitive regex (no established full-text-search
// convention in this repo yet), which can't use an index prefix, so the only equality filter
// worth compounding with the sort key is `eventType`. A plain, unfiltered browse is covered by
// the collection's default `_id` index.
export const eventIndexes = [
  { key: { eventType: 1, _id: -1 }, name: 'eventType_id' },
  { key: { organizerAccountId: 1, _id: -1 }, name: 'organizerAccountId_id' },
] as const;
