import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApplicationStatus } from './application.model.js';
import type { HiringService, PageParams } from './service.js';

export interface ApplyBody {
  listingId: string;
  message?: string;
}

export interface UpdateApplicationStatusBody {
  status: Exclude<ApplicationStatus, 'pending' | 'withdrawn'>;
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

export interface ContractIdParams {
  id: string;
}

export interface InvitationIdParams {
  id: string;
}

export interface InviteTalentBody {
  creativeAccountId: string;
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

  withdrawApplication = async (
    request: FastifyRequest<{ Params: ApplicationIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.withdrawApplication(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };

  listMyContracts = async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listMyContracts(request.user.sub, pageParams(request.query));
    await reply.send({ success: true, data });
  };

  completeContract = async (
    request: FastifyRequest<{ Params: ContractIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.completeContract(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };

  inviteTalent = async (
    request: FastifyRequest<{ Params: ListingIdParams; Body: InviteTalentBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.inviteTalent(
      request.user.sub,
      request.params.listingId,
      request.body.creativeAccountId,
    );
    await reply.code(201).send({ success: true, data });
  };

  listMyInvitations = async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listMyInvitations(request.user.sub, pageParams(request.query));
    await reply.send({ success: true, data });
  };

  acceptInvitation = async (
    request: FastifyRequest<{ Params: InvitationIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.acceptInvitation(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };

  declineInvitation = async (
    request: FastifyRequest<{ Params: InvitationIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.declineInvitation(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };

  getMyStats = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const data = await this.service.getMyStats(request.user.sub);
    await reply.send({ success: true, data });
  };
}
