import type { FastifyInstance } from 'fastify';
import { NotificationPreferencesRepository } from './repository.js';
import { NotificationPreferencesService } from './service.js';
import { NotificationsController } from './controller.js';
import { registerNotificationsRoutes } from './routes.js';

// Not wrapped in fastify-plugin — needs its own encapsulated context for
// `{ prefix: '/notifications' }` to apply, same reasoning as the other route-registering modules.
export default async function notificationsModule(app: FastifyInstance): Promise<void> {
  const repository = new NotificationPreferencesRepository(app.mongo.db);
  await repository.createIndexes();

  const service = new NotificationPreferencesService(repository);
  const controller = new NotificationsController(service);
  registerNotificationsRoutes(app, controller);
}
