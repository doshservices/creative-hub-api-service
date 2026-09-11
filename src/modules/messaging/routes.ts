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
        description: '**Any account type** — either side can start or continue a conversation.',
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
        description: '**Any account type.**',
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
        description: '**Any account type** — must be a participant in the conversation.',
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
        description: '**Any account type** — must be a participant in the conversation.',
        params: conversationIdParamSchema,
      },
    },
    controller.markRead,
  );
}
