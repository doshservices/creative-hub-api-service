import type { Db } from 'mongodb';
import type { FastifyInstance } from 'fastify';
import { ListingRepository } from './repository.js';
import { ListingService } from './service.js';
import { ListingsController } from './controller.js';
import { registerListingsRoutes } from './routes.js';
import { registerListingsEventSubscribers } from './events.js';
import type { ListingStatsDTO } from './dto.js';

export { ListingRepository } from './repository.js';
export type { ListingDTO, ListingPage, ListingStatsDTO } from './dto.js';

// Platform-wide aggregation for the admin composition module's stats endpoint — a single
// aggregation pipeline, no `find({})`. Same "plain function taking db, constructs its own
// repository" pattern as wallet/index.ts's getBalancesByAccountIds and identity/index.ts's
// getStatusesByAccountIds.
export async function getPlatformListingStats(db: Db): Promise<ListingStatsDTO> {
  return new ListingRepository(db).platformStats();
}

// Not wrapped in fastify-plugin — needs its own encapsulated context for `{ prefix: '/listings' }`
// to apply, same reasoning as the auth and users modules.
export default async function listingsModule(app: FastifyInstance): Promise<void> {
  const repository = new ListingRepository(app.mongo.db);
  await repository.createIndexes();

  const service = new ListingService(repository, app.audit);
  const controller = new ListingsController(service);
  registerListingsRoutes(app, controller);
  registerListingsEventSubscribers(app.eventBus, service);
}
