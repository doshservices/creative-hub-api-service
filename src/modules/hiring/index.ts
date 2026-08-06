import type { FastifyInstance } from 'fastify';
import { ListingRepository } from '../listings/index.js';
import { ApplicationRepository } from './application.repository.js';
import { ContractRepository } from './contract.repository.js';
import { HiringService } from './service.js';
import { HiringController } from './controller.js';
import { registerHiringRoutes } from './routes.js';

// Not wrapped in fastify-plugin — needs its own encapsulated context for `{ prefix: '/hiring' }`
// to apply, same reasoning as the other route-registering modules.
export default async function hiringModule(app: FastifyInstance): Promise<void> {
  const applicationRepository = new ApplicationRepository(app.mongo.db);
  await applicationRepository.createIndexes();

  const contractRepository = new ContractRepository(app.mongo.db);
  await contractRepository.createIndexes();

  // Cross-module read through listings' public surface (its index.ts), never its model/collection
  // directly — see CLAUDE.md's cross-module import rule.
  const listingRepository = new ListingRepository(app.mongo.db);

  const service = new HiringService(
    applicationRepository,
    contractRepository,
    listingRepository,
    app.audit,
  );
  const controller = new HiringController(service);
  registerHiringRoutes(app, controller);
}
