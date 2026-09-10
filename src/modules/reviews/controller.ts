import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PageParams, ReviewsService } from './service.js';

export interface SubmitReviewBody {
  rating: number;
  comment?: string;
}

export interface ContractIdParams {
  id: string;
}

export interface AccountIdParams {
  accountId: string;
}

export interface ListQuery {
  limit?: number;
  cursor?: string;
}

const DEFAULT_LIMIT = 20;

function pageParams(query: ListQuery): PageParams {
  return {
    limit: query.limit ?? DEFAULT_LIMIT,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  };
}

export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  submitReview = async (
    request: FastifyRequest<{ Params: ContractIdParams; Body: SubmitReviewBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.submitReview(request.user.sub, request.params.id, request.body);
    await reply.code(201).send({ success: true, data });
  };

  listReceivedReviews = async (
    request: FastifyRequest<{ Params: AccountIdParams; Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listReceivedByAccount(
      request.params.accountId,
      pageParams(request.query),
    );
    await reply.send({ success: true, data });
  };
}
