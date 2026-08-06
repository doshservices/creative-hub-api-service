import type { FastifyReply, FastifyRequest } from 'fastify';
import type { MessagingService, PageParams } from './service.js';

export interface SendMessageBody {
  recipientAccountId: string;
  content: string;
}

export interface ListQuery {
  limit?: number;
  cursor?: string;
}

export interface ConversationIdParams {
  id: string;
}

const DEFAULT_LIMIT = 20;

function pageParams(query: ListQuery): PageParams {
  return {
    limit: query.limit ?? DEFAULT_LIMIT,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  };
}

export class MessagingController {
  constructor(private readonly service: MessagingService) {}

  sendMessage = async (
    request: FastifyRequest<{ Body: SendMessageBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.sendMessage(
      request.user.sub,
      request.body.recipientAccountId,
      request.body.content,
    );
    await reply.code(201).send({ success: true, data });
  };

  listMyConversations = async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listMyConversations(
      request.user.sub,
      pageParams(request.query),
    );
    await reply.send({ success: true, data });
  };

  listMessages = async (
    request: FastifyRequest<{ Params: ConversationIdParams; Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listMessages(
      request.user.sub,
      request.params.id,
      pageParams(request.query),
    );
    await reply.send({ success: true, data });
  };

  markRead = async (
    request: FastifyRequest<{ Params: ConversationIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    await this.service.markRead(request.user.sub, request.params.id);
    await reply.code(204).send();
  };
}
