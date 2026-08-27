import type { FastifyInstance } from 'fastify';
import { ContractRepository } from '../hiring/index.js';
import { FileRepository } from '../files/index.js';
import { DeliverableRepository } from './repository.js';
import { CollaborationService } from './service.js';
import { CollaborationController } from './controller.js';
import { registerCollaborationRoutes } from './routes.js';

// Not wrapped in fastify-plugin — needs its own encapsulated context for
// `{ prefix: '/collaboration' }` to apply, same reasoning as the other route-registering modules.
export default async function collaborationModule(app: FastifyInstance): Promise<void> {
  const deliverableRepository = new DeliverableRepository(app.mongo.db);
  await deliverableRepository.createIndexes();

  // Cross-module reads through each module's public surface (its index.ts) — never another
  // module's model/collection directly, same pattern as hiring reading listings.
  const contractRepository = new ContractRepository(app.mongo.db);
  const fileRepository = new FileRepository(app.mongo.db);

  const service = new CollaborationService(deliverableRepository, contractRepository, fileRepository);
  const controller = new CollaborationController(service);
  registerCollaborationRoutes(app, controller);
}
