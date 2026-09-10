import type { FastifyInstance } from 'fastify';
import { ListingRepository } from './repository.js';
import { ListingService } from './service.js';
import { ListingsController } from './controller.js';
import { registerListingsRoutes } from './routes.js';
import { registerListingsEventSubscribers } from './events.js';

export { ListingRepository } from './repository.js';
export type { ListingDTO, ListingPage, ListingStatsDTO } from './dto.js';

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
