import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import type { AccountIdParams, ContractIdParams, ListQuery, ReviewsController, SubmitReviewBody } from './controller.js';
import {
  accountIdParamSchema,
  contractIdParamSchema,
  listQuerySchema,
  reviewPageResponseSchema,
  reviewResponseSchema,
  submitReviewBodySchema,
} from './schema.js';

export function registerReviewsRoutes(app: FastifyInstance, controller: ReviewsController): void {
  const requireReviewsSubmit = app.requirePermission(PERMISSIONS.REVIEWS_SUBMIT);

  // Both parties on a completed contract can leave a review — ownership (is the caller actually
  // one of the contract's two parties) and eligibility (is the contract completed, has this
  // reviewer already reviewed it) are checked in the service against the loaded contract, never
  // a client-supplied field.
  app.post<{ Params: ContractIdParams; Body: SubmitReviewBody }>(
    '/contracts/:id/review',
    {
      preHandler: [app.authenticate, requireReviewsSubmit],
      schema: {
        tags: ['Reviews'],
        summary: 'Submit a review on a completed contract',
        description:
          '**Creative or client accounts** (requires `reviews:submit`, granted to both account types by default), must be a party to the completed contract.',
        params: contractIdParamSchema,
        body: submitReviewBodySchema,
        response: { 201: reviewResponseSchema },
      },
    },
    controller.submitReview,
  );

  // Public browse — any authenticated account can view reviews received by a talent, no special
  // permission. Same pattern as users' GET /talents/:accountId.
  app.get<{ Params: AccountIdParams; Querystring: ListQuery }>(
    '/talents/:accountId/reviews',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Reviews'],
        summary: "List a talent's received reviews",
        description: '**Any account type** — public browse.',
        params: accountIdParamSchema,
        querystring: listQuerySchema,
        response: { 200: reviewPageResponseSchema },
      },
    },
    controller.listReceivedReviews,
  );
}
