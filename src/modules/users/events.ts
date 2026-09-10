import type { FastifyInstance } from 'fastify';

// The `reviews` module doesn't exist yet — this subscriber simply won't receive anything until
// it's built and starts publishing `review.created`. See src/common/event-bus.ts: a handler
// throwing must never take down the publisher, and this is a cache-maintenance optimization, not
// a source of truth (the ledger-equivalent here is the `reviews` module's own rating aggregation,
// a reconciliation job can fall back to it).
export interface ReviewCreatedEvent {
  reviewId: string;
  contractId: string;
  revieweeAccountId: string;
  rating: number;
}

export interface RatingRecorderPort {
  recordReviewRating(revieweeAccountId: string, rating: number): Promise<void>;
}

export function registerUserEventSubscriptions(
  app: FastifyInstance,
  ratings: RatingRecorderPort,
): void {
  app.eventBus.subscribe<ReviewCreatedEvent>('review.created', async (payload) => {
    await ratings.recordReviewRating(payload.revieweeAccountId, payload.rating);
  });
}
