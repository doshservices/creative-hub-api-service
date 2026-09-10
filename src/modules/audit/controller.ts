import type { FastifyReply, FastifyRequest } from 'fastify';
import { BadRequestError } from '../../common/errors.js';
import type { AuditEntryListParams } from './repository.js';
import type { AuditService } from './service.js';

export interface AdminAuditQuery {
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

const DEFAULT_LIMIT = 20;

// A second line of defense so a malformed value fails clearly here rather than reaching Mongo
// as an Invalid Date — same convention as wallet/service.ts's parseOptionalDate.
function parseOptionalDate(value: string | undefined, label: string): Date | undefined {
  if (value === undefined) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestError(`${label} must be a valid ISO date`);
  }
  return date;
}

export class AuditController {
  constructor(private readonly service: AuditService) {}

  listAudit = async (
    request: FastifyRequest<{ Querystring: AdminAuditQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const { action, actorId, from, to, limit, cursor } = request.query;
    const parsedFrom = parseOptionalDate(from, '"from"');
    const parsedTo = parseOptionalDate(to, '"to"');
    const params: AuditEntryListParams = {
      limit: limit ?? DEFAULT_LIMIT,
      ...(cursor ? { cursor } : {}),
      ...(action ? { action } : {}),
      ...(actorId ? { actorId } : {}),
      ...(parsedFrom ? { from: parsedFrom } : {}),
      ...(parsedTo ? { to: parsedTo } : {}),
    };
    const data = await this.service.list(params);
    await reply.send({ success: true, data });
  };
}
