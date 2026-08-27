import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PageParams, PaymentsService } from './service.js';

export interface InitiateDepositBody {
  amountMinor: number;
  currency?: string;
}

export interface InitiateWithdrawalBody {
  amountMinor: number;
  currency?: string;
  bankCode: string;
  accountNumber: string;
}

export interface IdParams {
  id: string;
}

export interface ListQuery {
  limit?: number;
  cursor?: string;
}

export interface FlutterwaveWebhookBody {
  event: string;
  data: Record<string, unknown>;
}

function pageParams(query: ListQuery): PageParams {
  return {
    limit: query.limit ?? 20,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  };
}

export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  initiateDeposit = async (
    request: FastifyRequest<{ Body: InitiateDepositBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.initiateDeposit(request.user.sub, request.body);
    await reply.code(201).send({ success: true, data });
  };

  getMyDeposit = async (
    request: FastifyRequest<{ Params: IdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.getMyDeposit(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };

  listMyDeposits = async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listMyDeposits(request.user.sub, pageParams(request.query));
    await reply.send({ success: true, data });
  };

  initiateWithdrawal = async (
    request: FastifyRequest<{ Body: InitiateWithdrawalBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.initiateWithdrawal(request.user.sub, request.body);
    await reply.code(201).send({ success: true, data });
  };

  getMyWithdrawal = async (
    request: FastifyRequest<{ Params: IdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.getMyWithdrawal(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };

  listMyWithdrawals = async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listMyWithdrawals(request.user.sub, pageParams(request.query));
    await reply.send({ success: true, data });
  };

  // Public route (no auth) — the preHandler chain verifies the `verif-hash` header before this
  // ever runs. Always acks 200 once the payload is well-formed and the signature checks out, so
  // Flutterwave doesn't retry-storm us over an event we simply don't recognize.
  handleWebhook = async (
    request: FastifyRequest<{ Body: FlutterwaveWebhookBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const { event, data } = request.body;

    if (event === 'charge.completed') {
      const txRef = data.tx_ref;
      const providerTransactionId = data.id;
      if (
        typeof txRef === 'string' &&
        (typeof providerTransactionId === 'string' || typeof providerTransactionId === 'number')
      ) {
        await this.service.handleChargeCompleted(txRef, String(providerTransactionId));
      }
    } else if (event === 'transfer.completed') {
      const reference = data.reference;
      const providerTransferId = data.id;
      if (
        typeof reference === 'string' &&
        (typeof providerTransferId === 'string' || typeof providerTransferId === 'number')
      ) {
        await this.service.handleTransferCompleted(reference, String(providerTransferId));
      }
    }

    await reply.send({ success: true, data: null });
  };
}
