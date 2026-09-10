import type { FastifyInstance } from 'fastify';
import { EventRepository } from './repository.js';
import { EventAttendeeRepository } from './event-attendee.repository.js';
import { EventService, type TransactionRunnerPort } from './service.js';
import { EventsController } from './controller.js';
import { registerEventsRoutes } from './routes.js';

export { EventRepository } from './repository.js';
export type { EventDTO, EventPage } from './dto.js';

// Not wrapped in fastify-plugin — needs its own encapsulated context for `{ prefix: '/events' }`
// to apply, same reasoning as the listings/hiring/wallet modules.
export default async function eventsModule(app: FastifyInstance): Promise<void> {
  const eventRepository = new EventRepository(app.mongo.db);
  await eventRepository.createIndexes();

  const attendeeRepository = new EventAttendeeRepository(app.mongo.db);
  await attendeeRepository.createIndexes();

  // Backs the RSVP/cancel-RSVP flow: the attendee-doc write and the capacity-guarded
  // attendeeCount update run inside one Mongo session so they commit or roll back together —
  // see the mongo-data-layer skill on transactions. Requires Mongo to be a replica set (Atlas
  // always is; local dev's docker-compose runs a single-node replica set for the same reason).
  const transactionRunner = createTransactionRunner(app);

  const service = new EventService(eventRepository, attendeeRepository, transactionRunner);
  const controller = new EventsController(service);
  registerEventsRoutes(app, controller);
}

// Local to this module, mirroring wallet's createTransactionRunner (see wallet/index.ts) rather
// than importing it — cross-module imports only go through a module's index.ts, and this port is
// small enough not to be worth sharing.
export function createTransactionRunner(app: FastifyInstance): TransactionRunnerPort {
  return {
    async withTransaction(fn) {
      const session = app.mongo.client.startSession();
      try {
        return await session.withTransaction(() => fn(session));
      } finally {
        await session.endSession();
      }
    },
  };
}
