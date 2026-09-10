import type { FastifyReply, FastifyRequest } from 'fastify';
import { DEFAULT_STATS_DAYS, type AdminService } from './service.js';

export interface ListQuery {
  limit?: number;
  cursor?: string;
}

export interface StatsQuery {
  days?: number;
}

const DEFAULT_LIMIT = 20;

function pageParams(query: ListQuery): { limit: number; cursor?: string } {
  return {
    limit: query.limit ?? DEFAULT_LIMIT,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  };
}

export class AdminController {
  constructor(private readonly service: AdminService) {}

  listTalents = async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listTalents(pageParams(request.query));
    await reply.send({ success: true, data });
  };

  listEmployers = async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listEmployers(pageParams(request.query));
    await reply.send({ success: true, data });
  };

  stats = async (
    request: FastifyRequest<{ Querystring: StatsQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.getStats({ days: request.query.days ?? DEFAULT_STATS_DAYS });
    await reply.send({ success: true, data });
  };
}
