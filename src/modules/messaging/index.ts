import type { FastifyInstance } from 'fastify';
import { AccountRepository } from '../auth/index.js';
import { ConversationRepository } from './conversation.repository.js';
import { MessageRepository } from './message.repository.js';
import { MessagingService } from './service.js';
import { MessagingController } from './controller.js';
import { registerMessagingRoutes } from './routes.js';

// Not wrapped in fastify-plugin — needs its own encapsulated context for
// `{ prefix: '/messaging' }` to apply, same reasoning as the other route-registering modules.
export default async function messagingModule(app: FastifyInstance): Promise<void> {
  const conversationRepository = new ConversationRepository(app.mongo.db);
  await conversationRepository.createIndexes();

  const messageRepository = new MessageRepository(app.mongo.db);
  await messageRepository.createIndexes();

  // Cross-module read through auth's public surface (its index.ts), never its model/collection
  // directly — see CLAUDE.md's cross-module import rule.
  const accountRepository = new AccountRepository(app.mongo.db);

  const service = new MessagingService(
    conversationRepository,
    messageRepository,
    accountRepository,
  );
  const controller = new MessagingController(service);
  registerMessagingRoutes(app, controller);
}
