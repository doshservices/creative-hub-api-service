import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Currency, PaymentType } from './model.js';
import type { ListingService } from './service.js';

export interface CreateListingBody {
  title: string;
  description: string;
  location: string;
  paymentType: PaymentType;
  amountMinor: number;
  currency: Currency;
  duration: string;
}

export interface ListQuery {
  limit?: number;
  cursor?: string;
}

export interface ListingIdParams {
  id: string;
}

const DEFAULT_LIMIT = 20;

function pageParams(query: ListQuery): { limit: number; cursor?: string } {
  return {
    limit: query.limit ?? DEFAULT_LIMIT,
    ...(query.cursor ? { cursor: query.cursor } : {}),
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

  getById = async (
    request: FastifyRequest<{ Params: ListingIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.getById(request.params.id);
    await reply.send({ success: true, data });
  };

  listOpen = async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listOpen(pageParams(request.query));
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
}
