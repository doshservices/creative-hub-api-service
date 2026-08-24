import type { FastifyInstance } from 'fastify';
import { objectIdSchema } from '../../common/schema.js';
import type {
  ConversationIdParams,
  ListQuery,
  MessagingController,
  SendMessageBody,
} from './controller.js';
import {
  conversationListQuerySchema,
  conversationPageResponseSchema,
  messageListQuerySchema,
  messagePageResponseSchema,
  messageResponseSchema,
  sendMessageBodySchema,
} from './schema.js';

const conversationIdParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: objectIdSchema },
} as const;

export function registerMessagingRoutes(
  app: FastifyInstance,
  controller: MessagingController,
): void {
  app.post<{ Body: SendMessageBody }>(
    '/messages',
    {
      preHandler: app.authenticate,
      schema: { body: sendMessageBodySchema, response: { 201: messageResponseSchema } },
    },
    controller.sendMessage,
  );

  app.get<{ Querystring: ListQuery }>(
    '/conversations',
    {
      preHandler: app.authenticate,
      schema: {
        querystring: conversationListQuerySchema,
        response: { 200: conversationPageResponseSchema },
      },
    },
    controller.listMyConversations,
  );

  app.get<{ Params: ConversationIdParams; Querystring: ListQuery }>(
    '/conversations/:id/messages',
    {
      preHandler: app.authenticate,
      schema: {
        params: conversationIdParamSchema,
        querystring: messageListQuerySchema,
        response: { 200: messagePageResponseSchema },
      },
    },
    controller.listMessages,
  );

  app.post<{ Params: ConversationIdParams }>(
    '/conversations/:id/read',
    { preHandler: app.authenticate, schema: { params: conversationIdParamSchema } },
    controller.markRead,
  );
}
