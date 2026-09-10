import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AdminLedgerQueryParams, PageParams, WalletService } from './service.js';
import { DEFAULT_CURRENCY } from './service.js';

export interface WalletQuery {
  currency?: string;
}

export interface LedgerQuery {
  currency?: string;
  limit?: number;
  cursor?: string;
}

export interface SummaryQuery {
  currency?: string;
}

export interface AdminLedgerQuery {
  accountId?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export class WalletController {
  constructor(private readonly service: WalletService) {}

  getMyWallet = async (
    request: FastifyRequest<{ Querystring: WalletQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.getOrCreateWallet(
      request.user.sub,
      request.query.currency ?? DEFAULT_CURRENCY,
    );
    await reply.send({ success: true, data });
  };

  listMyLedger = async (
    request: FastifyRequest<{ Querystring: LedgerQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const params: PageParams = {
      limit: request.query.limit ?? 20,
      ...(request.query.cursor ? { cursor: request.query.cursor } : {}),
    };
    const data = await this.service.listLedger(
      request.user.sub,
      request.query.currency ?? DEFAULT_CURRENCY,
      params,
    );
    await reply.send({ success: true, data });
  };

  getMySummary = async (
    request: FastifyRequest<{ Querystring: SummaryQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.getSummary(
      request.user.sub,
      request.query.currency ?? DEFAULT_CURRENCY,
    );
    await reply.send({ success: true, data });
  };

  listAdminLedger = async (
    request: FastifyRequest<{ Querystring: AdminLedgerQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const params: AdminLedgerQueryParams = {
      limit: request.query.limit ?? 20,
      ...(request.query.cursor ? { cursor: request.query.cursor } : {}),
      ...(request.query.accountId ? { accountId: request.query.accountId } : {}),
      ...(request.query.from ? { from: request.query.from } : {}),
      ...(request.query.to ? { to: request.query.to } : {}),
    };
    const data = await this.service.listAllLedger(params);
    await reply.send({ success: true, data });
  };
}
