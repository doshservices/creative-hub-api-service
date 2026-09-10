import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AvailableDay, HourlyRateBand, ProjectRateBand, YearsOfExperience } from './model.js';
import type { PortfolioMediaType } from './portfolio-item.model.js';
import type { UploadPurpose, UsersService } from './service.js';

export interface UpsertCreativeProfileBody {
  primaryRole: string;
  bio?: string;
  location?: string;
  profilePhotoKey?: string;
  skills: string[];
  yearsOfExperience?: YearsOfExperience;
  previousWorkExperience?: string;
  portfolioFileKey?: string;
  availableDays?: AvailableDay[];
  availableToTravel?: boolean;
  hourlyRateBand?: HourlyRateBand;
  projectRateBand?: ProjectRateBand;
}

export interface CreateUploadUrlBody {
  purpose: UploadPurpose;
  contentType: string;
}

export interface TalentSearchQuery {
  category?: string;
  location?: string;
  hourlyRateBand?: HourlyRateBand;
  availableToTravel?: boolean;
  limit?: number;
  cursor?: string;
}

export interface AccountIdParams {
  accountId: string;
}

export interface PageQuery {
  limit?: number;
  cursor?: string;
}

export interface CreatePortfolioItemBody {
  fileId: string;
  mediaType: PortfolioMediaType;
  title?: string;
}

export interface PortfolioItemIdParams {
  id: string;
}

export interface UpsertEmployerProfileBody {
  companyName: string;
  industry?: string;
  bio?: string;
  logoFileKey?: string;
}

const DEFAULT_LIMIT = 20;

function pageParams(query: PageQuery): { limit: number; cursor?: string } {
  return {
    limit: query.limit ?? DEFAULT_LIMIT,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  };
}

export class UsersController {
  constructor(private readonly service: UsersService) {}

  // -- Creative profile (self-service) -------------------------------------------------------

  getMyCreativeProfile = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const data = await this.service.getOwnProfile(request.user.sub);
    await reply.send({ success: true, data });
  };

  upsertMyCreativeProfile = async (
    request: FastifyRequest<{ Body: UpsertCreativeProfileBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.upsertOwnProfile(request.user.sub, request.body);
    await reply.send({ success: true, data });
  };

  createUploadUrl = async (
    request: FastifyRequest<{ Body: CreateUploadUrlBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.createUploadUrl(
      request.user.sub,
      request.body.purpose,
      request.body.contentType,
    );
    await reply.code(201).send({ success: true, data });
  };

  // -- Public talent search -------------------------------------------------------------------

  searchTalents = async (
    request: FastifyRequest<{ Querystring: TalentSearchQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const { category, location, hourlyRateBand, availableToTravel } = request.query;
    const data = await this.service.searchTalents(
      {
        ...(category !== undefined ? { category } : {}),
        ...(location !== undefined ? { location } : {}),
        ...(hourlyRateBand !== undefined ? { hourlyRateBand } : {}),
        ...(availableToTravel !== undefined ? { availableToTravel } : {}),
      },
      pageParams(request.query),
    );
    await reply.send({ success: true, data });
  };

  getPublicTalent = async (
    request: FastifyRequest<{ Params: AccountIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.getPublicProfile(request.params.accountId);
    await reply.send({ success: true, data });
  };

  // -- Portfolio gallery ------------------------------------------------------------------------

  addPortfolioItem = async (
    request: FastifyRequest<{ Body: CreatePortfolioItemBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.addPortfolioItem(request.user.sub, request.body);
    await reply.code(201).send({ success: true, data });
  };

  listMyPortfolioItems = async (
    request: FastifyRequest<{ Querystring: PageQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listMyPortfolioItems(
      request.user.sub,
      pageParams(request.query),
    );
    await reply.send({ success: true, data });
  };

  deletePortfolioItem = async (
    request: FastifyRequest<{ Params: PortfolioItemIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await this.service.deletePortfolioItem(request.user.sub, request.params.id);
    await reply.send({ success: true });
  };

  listPublicPortfolioItems = async (
    request: FastifyRequest<{ Params: AccountIdParams; Querystring: PageQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listPublicPortfolioItems(
      request.params.accountId,
      pageParams(request.query),
    );
    await reply.send({ success: true, data });
  };

  // -- Employer/company profile -----------------------------------------------------------------

  getMyEmployerProfile = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const data = await this.service.getOwnEmployerProfile(request.user.sub);
    await reply.send({ success: true, data });
  };

  upsertMyEmployerProfile = async (
    request: FastifyRequest<{ Body: UpsertEmployerProfileBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.upsertOwnEmployerProfile(request.user.sub, request.body);
    await reply.send({ success: true, data });
  };
}
