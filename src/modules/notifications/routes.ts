import type { FastifyInstance } from 'fastify';
import type { NotificationsController, UpdatePreferencesBody } from './controller.js';
import { preferencesResponseSchema, updatePreferencesBodySchema } from './schema.js';

export function registerNotificationsRoutes(
  app: FastifyInstance,
  controller: NotificationsController,
): void {
  app.get(
    '/preferences',
    { preHandler: app.authenticate, schema: { response: { 200: preferencesResponseSchema } } },
    controller.getMyPreferences,
  );

  app.put<{ Body: UpdatePreferencesBody }>(
    '/preferences',
    {
      preHandler: app.authenticate,
      schema: { body: updatePreferencesBodySchema, response: { 200: preferencesResponseSchema } },
    },
    controller.updateMyPreferences,
  );
}
