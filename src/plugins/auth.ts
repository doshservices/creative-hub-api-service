import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../common/errors.js';

export interface AccessTokenPayload {
  sub: string;
  permissions: string[];
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (
      permission: string,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// Stateless access-token verification. Permission checks are separate preHandlers per route
// (`permission:string`), never a role check — see CLAUDE.md.
export default fp(async function authPlugin(app: FastifyInstance) {
  await app.register(jwt, {
    secret: app.config.jwt.accessSecret,
    sign: { expiresIn: app.config.jwt.accessTtl },
  });

  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  });

  // Must run after `authenticate` in a route's preHandler chain — it reads request.user.
  app.decorate('requirePermission', (permission: string) => {
    return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      if (!request.user.permissions.includes(permission)) {
        throw new ForbiddenError(`Missing required permission: ${permission}`);
      }
    };
  });
});
