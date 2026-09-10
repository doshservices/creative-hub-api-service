import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createEventBus, type EventBus } from '../common/event-bus.js';

declare module 'fastify' {
  interface FastifyInstance {
    eventBus: EventBus;
  }
}

// Shared in-process pub/sub decorated on the root instance so a module can publish a
// cache-maintenance event (e.g. hiring's application.created) without another module importing
// its repository/service — see src/common/event-bus.ts and CLAUDE.md's cross-module import rule.
export default fp(async function eventBusPlugin(app: FastifyInstance) {
  app.decorate(
    'eventBus',
    createEventBus((event, error) => app.log.error({ err: error, event }, 'event handler failed')),
  );
});
