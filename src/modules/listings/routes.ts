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
      schema: {
        tags: ['Listings'],
        summary: 'Create a job listing',
        description:
          '**Client (employer) accounts only** (requires `listings:write`, granted to `client` accounts by default). Pass `publish: false` to save it as a draft instead of publishing it live.',
        body: createListingBodySchema,
        response: { 201: listingResponseSchema },
      },
    },
    controller.create,
  );

  app.get<{ Querystring: ListQuery }>(
    '/',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Listings'],
        summary: 'Browse open listings',
        description:
          '**Any account type** — typically used by `creative` accounts browsing for work, not permission-restricted. Public search/filter over published listings.',
        querystring: listQuerySchema,
        response: { 200: listingPageResponseSchema },
      },
    },
    controller.listPublic,
  );

  app.get<{ Querystring: ListQuery }>(
    '/mine',
    {
      preHandler: [app.authenticate, requireListingsWrite],
      schema: {
        tags: ['Listings'],
        summary: "List the caller's own listings",
        description: '**Client (employer) accounts only** (requires `listings:write`).',
        querystring: listQuerySchema,
        response: { 200: listingPageResponseSchema },
      },
    },
    controller.listMine,
  );

  // Registered before /:id so find-my-way's static route wins, even though its trie already
  // prioritizes static segments over parametric ones.
  app.get(
    '/mine/stats',
    {
      preHandler: [app.authenticate, requireListingsWrite],
      schema: {
        tags: ['Listings'],
        summary: "Get the caller's own listing stats",
        description: '**Client (employer) accounts only** (requires `listings:write`).',
        response: { 200: listingStatsResponseSchema },
      },
    },
    controller.myStats,
  );

  app.get<{ Params: ListingIdParams }>(
    '/:id',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Listings'],
        summary: 'Get a listing by id',
        description: '**Any account type.**',
        params: idParamSchema,
        response: { 200: listingResponseSchema },
      },
    },
    controller.getById,
  );

  app.put<{ Params: ListingIdParams; Body: UpdateListingBody }>(
    '/:id',
    {
      preHandler: [app.authenticate, requireListingsWrite],
      schema: {
        tags: ['Listings'],
        summary: 'Update a listing (owner only)',
        description: '**Client (employer) accounts only** (requires `listings:write`), owner only.',
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
      schema: {
        tags: ['Listings'],
        summary: 'Close a listing (owner only)',
        description: '**Client (employer) accounts only** (requires `listings:write`), owner only.',
        params: idParamSchema,
        response: { 200: listingResponseSchema },
      },
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
        tags: ['Listings', 'Admin'],
        summary: 'Flag a listing',
        description:
          "**Admin only** — requires `listings:moderate`, granted via an RBAC role assignment rather than by account type. Works on any client's listing, no ownership check.",
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
      schema: {
        tags: ['Listings', 'Admin'],
        summary: 'Unflag a listing',
        description:
          "**Admin only** — requires `listings:moderate`, granted via an RBAC role assignment rather than by account type. Works on any client's listing, no ownership check.",
        params: idParamSchema,
        response: { 200: listingResponseSchema },
      },
    },
    controller.unflag,
  );

  app.put<{ Params: ListingIdParams }>(
    '/admin/:id/close',
    {
      preHandler: [app.authenticate, requireListingsModerate],
      schema: {
        tags: ['Listings', 'Admin'],
        summary: 'Close a listing (admin override)',
        description:
          "**Admin only** — requires `listings:moderate`, granted via an RBAC role assignment rather than by account type. Works on any client's listing, no ownership check.",
        params: idParamSchema,
        response: { 200: listingResponseSchema },
      },
    },
    controller.adminClose,
  );
}
