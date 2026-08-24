import fp from 'fastify-plugin';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../common/errors.js';

function handleError(
  error: FastifyError | AppError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error instanceof AppError) {
    reply.code(error.statusCode).send({
      success: false,
      message: error.message,
      error: error.code,
    });
    return;
  }

  // Schema/validation failures thrown by Fastify itself before reaching a route handler.
  if (error.validation) {
    reply.code(400).send({
      success: false,
      message: 'Request validation failed',
      error: 'BAD_REQUEST',
    });
    return;
  }

  // Other framework-level errors Fastify itself rejects the request for before it reaches a
  // route (e.g. malformed/empty JSON body) already carry their own 4xx statusCode — honor it
  // instead of reporting a client mistake as a 500. A bare thrown error with no statusCode (or
  // one from the Mongo driver, which never sets this field) still falls through below.
  if (typeof error.statusCode === 'number' && error.statusCode < 500) {
    reply.code(error.statusCode).send({
      success: false,
      message: error.message,
      error: error.code ?? 'BAD_REQUEST',
    });
    return;
  }

  request.log.error(error);
  reply.code(500).send({
    success: false,
    message: 'Internal server error',
    error: 'INTERNAL_SERVER_ERROR',
  });
}

export default fp(function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler(handleError);

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({
      success: false,
      message: 'Route not found',
      error: 'NOT_FOUND',
    });
  });
});
