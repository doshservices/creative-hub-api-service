import type { EventType } from './model.js';

export interface EventDTO {
  id: string;
  organizerAccountId: string;
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

export interface EventPage {
  items: EventDTO[];
  nextCursor: string | null;
}

export interface EventAttendeeDTO {
  id: string;
  eventId: string;
  accountId: string;
  rsvpAt: Date;
}
