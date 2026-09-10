import type { FastifyReply, FastifyRequest } from 'fastify';
import type { EventService } from './service.js';
import type { EventType } from './model.js';

export interface CreateEventBody {
  title: string;
  description: string;
  eventType: EventType;
  category: string;
  location: string;
  startsAt: string;
  capacity: number;
}

export interface ListQuery {
  limit?: number;
  cursor?: string;
}

export interface BrowseEventsQuery extends ListQuery {
  search?: string;
  location?: string;
  eventType?: EventType;
}

export interface EventIdParams {
  id: string;
}

const DEFAULT_LIMIT = 20;

function pageParams(query: ListQuery): { limit: number; cursor?: string } {
  return {
    limit: query.limit ?? DEFAULT_LIMIT,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  };
}

export class EventsController {
  constructor(private readonly service: EventService) {}

  create = async (
    request: FastifyRequest<{ Body: CreateEventBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const { startsAt, ...rest } = request.body;
    const data = await this.service.create(request.user.sub, {
      ...rest,
      startsAt: new Date(startsAt),
    });
    await reply.code(201).send({ success: true, data });
  };

  browse = async (
    request: FastifyRequest<{ Querystring: BrowseEventsQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const { search, location, eventType, ...rest } = request.query;
    const data = await this.service.browse({
      ...pageParams(rest),
      ...(search ? { search } : {}),
      ...(location ? { location } : {}),
      ...(eventType ? { eventType } : {}),
    });
    await reply.send({ success: true, data });
  };

  getById = async (
    request: FastifyRequest<{ Params: EventIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.getById(request.params.id);
    await reply.send({ success: true, data });
  };

  listMine = async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listMine(request.user.sub, pageParams(request.query));
    await reply.send({ success: true, data });
  };

  rsvp = async (
    request: FastifyRequest<{ Params: EventIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.rsvp(request.user.sub, request.params.id);
    await reply.code(201).send({ success: true, data });
  };

  cancelRsvp = async (
    request: FastifyRequest<{ Params: EventIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.cancelRsvp(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };
}
