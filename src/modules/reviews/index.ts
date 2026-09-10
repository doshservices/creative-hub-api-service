import type { Db } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import { getContractById } from '../hiring/index.js';
import { ReviewRepository } from './repository.js';
import { ReviewsService, type ContractReaderPort } from './service.js';
import { ReviewsController } from './controller.js';
import { registerReviewsRoutes } from './routes.js';

export { ReviewRepository } from './repository.js';
export type { RatingAggregate, ReviewDTO, ReviewPage } from './dto.js';

// Real aggregation for a future reconciliation job against users' cached ratingSum/ratingCount
// fields — nothing calls this yet. See repository.ts's aggregateRatingsForAccounts.
export async function getRatingAggregateForAccounts(
  db: Db,
  accountIds: string[],
): Promise<Record<string, { ratingSum: number; ratingCount: number }>> {
  return new ReviewRepository(db).aggregateRatingsForAccounts(accountIds);
}

// Not wrapped in fastify-plugin — needs its own encapsulated context for `{ prefix: '/reviews' }`
// to apply, same reasoning as the other route-registering modules.
export default async function reviewsModule(app: FastifyInstance): Promise<void> {
  const repository = new ReviewRepository(app.mongo.db);
  await repository.createIndexes();

  // Cross-module read through hiring's public surface (its index.ts), never its
  // repository/model directly — see CLAUDE.md's cross-module import rule. getContractById only
  // needs a Db, so it's wired here as a simple port.
  const contractReader: ContractReaderPort = {
    findById: (id: string) => getContractById(app.mongo.db, id),
  };

  const service = new ReviewsService(repository, contractReader, app.eventBus);
  const controller = new ReviewsController(service);
  registerReviewsRoutes(app, controller);
}
