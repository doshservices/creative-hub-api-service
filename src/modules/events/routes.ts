import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import { objectIdSchema } from '../../common/schema.js';
import type {
  BrowseEventsQuery,
  CreateEventBody,
  EventIdParams,
  EventsController,
  ListQuery,
} from './controller.js';
import {
  browseEventsQuerySchema,
  createEventBodySchema,
  eventPageResponseSchema,
  eventResponseSchema,
  listQuerySchema,
} from './schema.js';

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: objectIdSchema },
} as const;

export function registerEventsRoutes(app: FastifyInstance, controller: EventsController): void {
  const requireEventsWrite = app.requirePermission(PERMISSIONS.EVENTS_WRITE);

  app.post<{ Body: CreateEventBody }>(
    '/',
    {
      preHandler: [app.authenticate, requireEventsWrite],
      schema: {
        tags: ['Events'],
        summary: 'Create an event',
        body: createEventBodySchema,
        response: { 201: eventResponseSchema },
      },
    },
    controller.create,
  );

  app.get<{ Querystring: BrowseEventsQuery }>(
    '/',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Events'],
        summary: 'Browse public events',
        querystring: browseEventsQuerySchema,
        response: { 200: eventPageResponseSchema },
      },
    },
    controller.browse,
  );

  app.get<{ Querystring: ListQuery }>(
    '/mine',
    {
      preHandler: [app.authenticate, requireEventsWrite],
      schema: {
        tags: ['Events'],
        summary: "List the caller's own organized events",
        querystring: listQuerySchema,
        response: { 200: eventPageResponseSchema },
      },
    },
    controller.listMine,
  );

  app.get<{ Params: EventIdParams }>(
    '/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Events'],
        summary: 'Get an event by id',
        params: idParamSchema,
        response: { 200: eventResponseSchema },
      },
    },
    controller.getById,
  );

  app.post<{ Params: EventIdParams }>(
    '/:id/rsvp',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Events'],
        summary: 'RSVP to an event',
        params: idParamSchema,
        response: { 201: eventResponseSchema },
      },
    },
    controller.rsvp,
  );

  app.delete<{ Params: EventIdParams }>(
    '/:id/rsvp',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Events'],
        summary: 'Cancel an RSVP',
        params: idParamSchema,
        response: { 200: eventResponseSchema },
      },
    },
    controller.cancelRsvp,
  );
}
