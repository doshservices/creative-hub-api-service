import type { ListingService } from './service.js';

// Payload shape published by hiring's application.created/application.withdrawn events — kept
// local rather than imported from hiring so this module doesn't reach into hiring's internals
// (see CLAUDE.md's cross-module import rule; events are the one exception, and even then only
// the payload shape is shared, never a type import across module boundaries).
export interface ApplicationEventPayload {
  listingId: string;
  applicationId: string;
}

// Minimal surface this module needs from the shared event bus (see src/plugins/event-bus.ts).
export interface EventSubscriberPort {
  subscribe<T>(event: string, handler: (payload: T) => void | Promise<void>): void;
}

// Cache-maintenance subscriber: keeps applicantCount in sync with hiring's application
// lifecycle. Best-effort per the event bus's contract — a handler throwing is caught by the bus
// itself and logged, never taking down the publisher; hiring's exported
// getApplicationCountsByListingIds remains the source of truth for a reconciliation job if this
// ever drifts.
export function registerListingsEventSubscribers(
  eventBus: EventSubscriberPort,
  service: ListingService,
): void {
  eventBus.subscribe<ApplicationEventPayload>('application.created', async (payload) => {
    await service.adjustApplicantCount(payload.listingId, 1);
  });
  eventBus.subscribe<ApplicationEventPayload>('application.withdrawn', async (payload) => {
    await service.adjustApplicantCount(payload.listingId, -1);
  });
}
