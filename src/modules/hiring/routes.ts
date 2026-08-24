import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import { objectIdSchema } from '../../common/schema.js';
import type {
  ApplicationIdParams,
  ApplyBody,
  HiringController,
  ListingIdParams,
  ListQuery,
  UpdateApplicationStatusBody,
} from './controller.js';
import {
  applicationPageResponseSchema,
  applicationResponseSchema,
  applyBodySchema,
  contractPageResponseSchema,
  listQuerySchema,
  updateApplicationStatusBodySchema,
} from './schema.js';

const listingIdParamSchema = {
  type: 'object',
  required: ['listingId'],
  properties: { listingId: objectIdSchema },
} as const;

const applicationIdParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: objectIdSchema },
} as const;

export function registerHiringRoutes(app: FastifyInstance, controller: HiringController): void {
  const requireHiringApply = app.requirePermission(PERMISSIONS.HIRING_APPLY);
  const requireListingsWrite = app.requirePermission(PERMISSIONS.LISTINGS_WRITE);

  app.post<{ Body: ApplyBody }>(
    '/applications',
    {
      preHandler: [app.authenticate, requireHiringApply],
      schema: { body: applyBodySchema, response: { 201: applicationResponseSchema } },
    },
    controller.apply,
  );

  app.get<{ Querystring: ListQuery }>(
    '/applications/mine',
    {
      preHandler: [app.authenticate, requireHiringApply],
      schema: { querystring: listQuerySchema, response: { 200: applicationPageResponseSchema } },
    },
    controller.listMyApplications,
  );

  app.get<{ Params: ListingIdParams; Querystring: ListQuery }>(
    '/listings/:listingId/applications',
    {
      preHandler: [app.authenticate, requireListingsWrite],
      schema: {
        params: listingIdParamSchema,
        querystring: listQuerySchema,
        response: { 200: applicationPageResponseSchema },
      },
    },
    controller.listApplicationsForListing,
  );

  app.put<{ Params: ApplicationIdParams; Body: UpdateApplicationStatusBody }>(
    '/applications/:id/status',
    {
      preHandler: [app.authenticate, requireListingsWrite],
      schema: {
        params: applicationIdParamSchema,
        body: updateApplicationStatusBodySchema,
        response: { 200: applicationResponseSchema },
      },
    },
    controller.updateApplicationStatus,
  );

  app.get<{ Querystring: ListQuery }>(
    '/contracts/mine',
    {
      preHandler: app.authenticate,
      schema: { querystring: listQuerySchema, response: { 200: contractPageResponseSchema } },
    },
    controller.listMyContracts,
  );
}
