import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CollaborationService, PageParams } from './service.js';

export interface SubmitDeliverableBody {
  fileId: string;
  note?: string;
}

export interface ReviewDeliverableBody {
  status: 'approved' | 'revision_requested';
  reviewNote?: string;
}

export interface ContractIdParams {
  contractId: string;
}

export interface DeliverableIdParams {
  id: string;
}

export interface ListQuery {
  limit?: number;
  cursor?: string;
}

function pageParams(query: ListQuery): PageParams {
  return {
    limit: query.limit ?? 20,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  };
}

export class CollaborationController {
  constructor(private readonly service: CollaborationService) {}

  submitDeliverable = async (
    request: FastifyRequest<{ Params: ContractIdParams; Body: SubmitDeliverableBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.submitDeliverable(
      request.user.sub,
      request.params.contractId,
      request.body,
    );
    await reply.code(201).send({ success: true, data });
  };

  listDeliverables = async (
    request: FastifyRequest<{ Params: ContractIdParams; Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listDeliverables(
      request.user.sub,
      request.params.contractId,
      pageParams(request.query),
    );
    await reply.send({ success: true, data });
  };

  getDeliverable = async (
    request: FastifyRequest<{ Params: DeliverableIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.getDeliverable(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };

  reviewDeliverable = async (
    request: FastifyRequest<{ Params: DeliverableIdParams; Body: ReviewDeliverableBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.reviewDeliverable(
      request.user.sub,
      request.params.id,
      request.body,
    );
    await reply.send({ success: true, data });
  };
}
