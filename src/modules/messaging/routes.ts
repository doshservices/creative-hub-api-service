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
      schema: {
        tags: ['Messaging'],
        summary: 'Send a message, creating the conversation if needed',
        body: sendMessageBodySchema,
        response: { 201: messageResponseSchema },
      },
    },
    controller.sendMessage,
  );

  app.get<{ Querystring: ListQuery }>(
    '/conversations',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Messaging'],
        summary: "List the caller's conversations",
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
        tags: ['Messaging'],
        summary: "List a conversation's messages",
        params: conversationIdParamSchema,
        querystring: messageListQuerySchema,
        response: { 200: messagePageResponseSchema },
      },
    },
    controller.listMessages,
  );

  app.post<{ Params: ConversationIdParams }>(
    '/conversations/:id/read',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Messaging'],
        summary: 'Mark a conversation as read',
        params: conversationIdParamSchema,
      },
    },
    controller.markRead,
  );
}
