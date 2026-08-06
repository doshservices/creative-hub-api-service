import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import type {
  CreateListingBody,
  ListingIdParams,
  ListingsController,
  ListQuery,
} from './controller.js';
import {
  createListingBodySchema,
  listingPageResponseSchema,
  listingResponseSchema,
  listQuerySchema,
} from './schema.js';

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string' } },
} as const;

export function registerListingsRoutes(app: FastifyInstance, controller: ListingsController): void {
  const requireListingsWrite = app.requirePermission(PERMISSIONS.LISTINGS_WRITE);

  app.post<{ Body: CreateListingBody }>(
    '/',
    {
      preHandler: [app.authenticate, requireListingsWrite],
      schema: { body: createListingBodySchema, response: { 201: listingResponseSchema } },
    },
    controller.create,
  );

  app.get<{ Querystring: ListQuery }>(
    '/',
    {
      preHandler: app.authenticate,
      schema: { querystring: listQuerySchema, response: { 200: listingPageResponseSchema } },
    },
    controller.listOpen,
  );

  app.get<{ Querystring: ListQuery }>(
    '/mine',
    {
      preHandler: [app.authenticate, requireListingsWrite],
      schema: { querystring: listQuerySchema, response: { 200: listingPageResponseSchema } },
    },
    controller.listMine,
  );

  app.get<{ Params: ListingIdParams }>(
    '/:id',
    {
      preHandler: app.authenticate,
      schema: { params: idParamSchema, response: { 200: listingResponseSchema } },
    },
    controller.getById,
  );

  app.post<{ Params: ListingIdParams }>(
    '/:id/close',
    {
      preHandler: [app.authenticate, requireListingsWrite],
      schema: { params: idParamSchema, response: { 200: listingResponseSchema } },
    },
    controller.close,
  );
}
