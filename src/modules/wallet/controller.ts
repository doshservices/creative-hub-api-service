import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PageParams, WalletService } from './service.js';
import { DEFAULT_CURRENCY } from './service.js';

export interface WalletQuery {
  currency?: string;
}

export interface LedgerQuery {
  currency?: string;
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
}
