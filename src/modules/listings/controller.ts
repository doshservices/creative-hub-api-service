import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Currency, PaymentType, ProjectType } from './model.js';
import type { ListingService } from './service.js';

export interface CreateListingBody {
  title: string;
  description: string;
  location: string;
  category: string;
  headcount?: number;
  projectType: ProjectType;
  paymentType: PaymentType;
  budgetMinMinor: number;
  budgetMaxMinor: number;
  currency: Currency;
  duration: string;
  publish?: boolean;
}

export type UpdateListingBody = Partial<CreateListingBody>;

export interface ListQuery {
  limit?: number;
  cursor?: string;
  search?: string;
  category?: string;
  location?: string;
  budgetMin?: number;
  budgetMax?: number;
}

export interface ListingIdParams {
  id: string;
}

export interface FlagListingBody {
  reason: string;
}

const DEFAULT_LIMIT = 20;

function pageParams(query: ListQuery): { limit: number; cursor?: string } {
  return {
    limit: query.limit ?? DEFAULT_LIMIT,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  };
}

function publicFilters(query: ListQuery) {
  return {
    ...(query.search ? { search: query.search } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.location ? { location: query.location } : {}),
    ...(query.budgetMin !== undefined ? { budgetMin: query.budgetMin } : {}),
    ...(query.budgetMax !== undefined ? { budgetMax: query.budgetMax } : {}),
  };
}

export class ListingsController {
  constructor(private readonly service: ListingService) {}

  create = async (
    request: FastifyRequest<{ Body: CreateListingBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.create(request.user.sub, request.body);
    await reply.code(201).send({ success: true, data });
  };

  update = async (
    request: FastifyRequest<{ Params: ListingIdParams; Body: UpdateListingBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.update(request.user.sub, request.params.id, request.body);
    await reply.send({ success: true, data });
  };

  getById = async (
    request: FastifyRequest<{ Params: ListingIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.getById(request.params.id);
    await reply.send({ success: true, data });
  };

  listPublic = async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listPublic(publicFilters(request.query), pageParams(request.query));
    await reply.send({ success: true, data });
  };

  listMine = async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listMine(request.user.sub, pageParams(request.query));
    await reply.send({ success: true, data });
  };

  close = async (
    request: FastifyRequest<{ Params: ListingIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.close(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };

  adminClose = async (
    request: FastifyRequest<{ Params: ListingIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.adminClose(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };

  flag = async (
    request: FastifyRequest<{ Params: ListingIdParams; Body: FlagListingBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.flag(request.user.sub, request.params.id, request.body.reason);
    await reply.send({ success: true, data });
  };

  unflag = async (
    request: FastifyRequest<{ Params: ListingIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.unflag(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };

  myStats = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const data = await this.service.getStatsForClient(request.user.sub);
    await reply.send({ success: true, data });
  };
}
