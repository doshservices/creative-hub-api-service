import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import type {
  CollaborationController,
  ContractIdParams,
  DeliverableIdParams,
  ListQuery,
  ReviewDeliverableBody,
  SubmitDeliverableBody,
} from './controller.js';
import {
  contractIdParamSchema,
  deliverableIdParamSchema,
  deliverablePageResponseSchema,
  deliverableResponseSchema,
  listQuerySchema,
  reviewDeliverableBodySchema,
  submitDeliverableBodySchema,
} from './schema.js';

export function registerCollaborationRoutes(
  app: FastifyInstance,
  controller: CollaborationController,
): void {
  const requireCollaborationSubmit = app.requirePermission(PERMISSIONS.COLLABORATION_SUBMIT);
  const requireCollaborationReview = app.requirePermission(PERMISSIONS.COLLABORATION_REVIEW);

  app.post<{ Params: ContractIdParams; Body: SubmitDeliverableBody }>(
    '/contracts/:contractId/deliverables',
    {
      preHandler: [app.authenticate, requireCollaborationSubmit],
      schema: {
        params: contractIdParamSchema,
        body: submitDeliverableBodySchema,
        response: { 201: deliverableResponseSchema },
      },
    },
    controller.submitDeliverable,
  );

  app.get<{ Params: ContractIdParams; Querystring: ListQuery }>(
    '/contracts/:contractId/deliverables',
    {
      preHandler: app.authenticate,
      schema: {
        params: contractIdParamSchema,
        querystring: listQuerySchema,
        response: { 200: deliverablePageResponseSchema },
      },
    },
    controller.listDeliverables,
  );

  app.get<{ Params: DeliverableIdParams }>(
    '/deliverables/:id',
    {
      preHandler: app.authenticate,
      schema: { params: deliverableIdParamSchema, response: { 200: deliverableResponseSchema } },
    },
    controller.getDeliverable,
  );

  app.put<{ Params: DeliverableIdParams; Body: ReviewDeliverableBody }>(
    '/deliverables/:id/review',
    {
      preHandler: [app.authenticate, requireCollaborationReview],
      schema: {
        params: deliverableIdParamSchema,
        body: reviewDeliverableBodySchema,
        response: { 200: deliverableResponseSchema },
      },
    },
    controller.reviewDeliverable,
  );
}
