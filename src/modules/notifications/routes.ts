import type { FastifyInstance } from 'fastify';
import type { NotificationsController, UpdatePreferencesBody } from './controller.js';
import { preferencesResponseSchema, updatePreferencesBodySchema } from './schema.js';

export function registerNotificationsRoutes(
  app: FastifyInstance,
  controller: NotificationsController,
): void {
  app.get(
    '/preferences',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Notifications'],
        summary: "Get the caller's notification preferences",
        response: { 200: preferencesResponseSchema },
      },
    },
    controller.getMyPreferences,
  );

  app.put<{ Body: UpdatePreferencesBody }>(
    '/preferences',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Notifications'],
        summary: "Update the caller's notification preferences",
        body: updatePreferencesBodySchema,
        response: { 200: preferencesResponseSchema },
      },
    },
    controller.updateMyPreferences,
  );
}
