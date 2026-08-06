import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApplicationStatus } from './application.model.js';
import type { HiringService, PageParams } from './service.js';

export interface ApplyBody {
  listingId: string;
  message?: string;
}

export interface UpdateApplicationStatusBody {
  status: Exclude<ApplicationStatus, 'pending'>;
}

export interface ListQuery {
  limit?: number;
  cursor?: string;
}

export interface ListingIdParams {
  listingId: string;
}

export interface ApplicationIdParams {
  id: string;
}

const DEFAULT_LIMIT = 20;

function pageParams(query: ListQuery): PageParams {
  return {
    limit: query.limit ?? DEFAULT_LIMIT,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  };
}

export class HiringController {
  constructor(private readonly service: HiringService) {}

  apply = async (
    request: FastifyRequest<{ Body: ApplyBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.apply(request.user.sub, request.body);
    await reply.code(201).send({ success: true, data });
  };

  listMyApplications = async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listMyApplications(request.user.sub, pageParams(request.query));
    await reply.send({ success: true, data });
  };

  listApplicationsForListing = async (
    request: FastifyRequest<{ Params: ListingIdParams; Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listApplicationsForListing(
      request.user.sub,
      request.params.listingId,
      pageParams(request.query),
    );
    await reply.send({ success: true, data });
  };

  updateApplicationStatus = async (
    request: FastifyRequest<{ Params: ApplicationIdParams; Body: UpdateApplicationStatusBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.updateApplicationStatus(
      request.user.sub,
      request.params.id,
      request.body.status,
    );
    await reply.send({ success: true, data });
  };

  listMyContracts = async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listMyContracts(request.user.sub, pageParams(request.query));
    await reply.send({ success: true, data });
  };
}
