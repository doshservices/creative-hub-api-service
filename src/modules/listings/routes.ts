import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import { objectIdSchema } from '../../common/schema.js';
import type {
  CreateListingBody,
  FlagListingBody,
  ListingIdParams,
  ListingsController,
  ListQuery,
  UpdateListingBody,
} from './controller.js';
import {
  createListingBodySchema,
  flagListingBodySchema,
  listingPageResponseSchema,
  listingResponseSchema,
  listingStatsResponseSchema,
  listQuerySchema,
  updateListingBodySchema,
} from './schema.js';

const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: objectIdSchema },
} as const;

export function registerListingsRoutes(app: FastifyInstance, controller: ListingsController): void {
  const requireListingsWrite = app.requirePermission(PERMISSIONS.LISTINGS_WRITE);
  const requireListingsModerate = app.requirePermission(PERMISSIONS.LISTINGS_MODERATE);

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
    controller.listPublic,
  );

  app.get<{ Querystring: ListQuery }>(
    '/mine',
    {
      preHandler: [app.authenticate, requireListingsWrite],
      schema: { querystring: listQuerySchema, response: { 200: listingPageResponseSchema } },
    },
    controller.listMine,
  );

  // Registered before /:id so find-my-way's static route wins, even though its trie already
  // prioritizes static segments over parametric ones.
  app.get(
    '/mine/stats',
    {
      preHandler: [app.authenticate, requireListingsWrite],
      schema: { response: { 200: listingStatsResponseSchema } },
    },
    controller.myStats,
  );

  app.get<{ Params: ListingIdParams }>(
    '/:id',
    {
      preHandler: app.authenticate,
      schema: { params: idParamSchema, response: { 200: listingResponseSchema } },
    },
    controller.getById,
  );

  app.put<{ Params: ListingIdParams; Body: UpdateListingBody }>(
    '/:id',
    {
      preHandler: [app.authenticate, requireListingsWrite],
      schema: {
        params: idParamSchema,
        body: updateListingBodySchema,
        response: { 200: listingResponseSchema },
      },
    },
    controller.update,
  );

  app.post<{ Params: ListingIdParams }>(
    '/:id/close',
    {
      preHandler: [app.authenticate, requireListingsWrite],
      schema: { params: idParamSchema, response: { 200: listingResponseSchema } },
    },
    controller.close,
  );

  // Admin moderation sub-routes, namespaced under this module's own /listings prefix (final
  // paths: /listings/admin/:id/flag etc). The plan's literal "/admin/listings/:id/flag" only
  // makes sense mounted globally alongside a future cross-cutting `admin` composition module,
  // which is explicitly out of scope for this change — keeping it here avoids a stuttering path
  // and avoids registering a second top-level prefix in app.ts for a module we're not building.
  app.put<{ Params: ListingIdParams; Body: FlagListingBody }>(
    '/admin/:id/flag',
    {
      preHandler: [app.authenticate, requireListingsModerate],
      schema: {
        params: idParamSchema,
        body: flagListingBodySchema,
        response: { 200: listingResponseSchema },
      },
    },
    controller.flag,
  );

  app.put<{ Params: ListingIdParams }>(
    '/admin/:id/unflag',
    {
      preHandler: [app.authenticate, requireListingsModerate],
      schema: { params: idParamSchema, response: { 200: listingResponseSchema } },
    },
    controller.unflag,
  );

  app.put<{ Params: ListingIdParams }>(
    '/admin/:id/close',
    {
      preHandler: [app.authenticate, requireListingsModerate],
      schema: { params: idParamSchema, response: { 200: listingResponseSchema } },
    },
    controller.adminClose,
  );
}
