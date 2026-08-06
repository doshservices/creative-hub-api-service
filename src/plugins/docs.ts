import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import scalarApiReferenceImport from '@scalar/fastify-api-reference';
import type { FastifyApiReferenceOptions } from '@scalar/fastify-api-reference';
import type { FastifyInstance, FastifyPluginCallback } from 'fastify';

// The package's own .d.ts chain has an unresolvable type reference (a missing types-only
// dependency), which degrades the default export's inferred type — re-assert the real shape
// rather than let that poison this file's type-aware lint pass.
const scalarApiReference =
  scalarApiReferenceImport as FastifyPluginCallback<FastifyApiReferenceOptions>;

// Generates the OpenAPI document from route schemas and serves it as an interactive Scalar
// reference at /reference. Every route's schema (see the http-routes rule) is what drives this —
// there's nothing to hand-write here.
export default fp(async function docsPlugin(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Creative Hub API',
        description: 'Marketplace backend: auth, listings, hiring, contracts, wallet, and more.',
        version: '0.1.0',
      },
      servers: [{ url: '/' }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(scalarApiReference, {
    routePrefix: '/reference',
    configuration: {
      title: 'Creative Hub API',
    },
  });
});
