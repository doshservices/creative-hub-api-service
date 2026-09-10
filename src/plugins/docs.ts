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
      // Applies to every operation by default — a route needs `security: []` in its own schema
      // only if it's genuinely public (register/login/refresh/logout, the Flutterwave webhook).
      // That's far less to maintain than tagging `security: [{ bearerAuth: [] }]` on every one
      // of the ~90 routes that actually require it.
      security: [{ bearerAuth: [] }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      // Fixes the sidebar's group order and gives each group a one-line description — Scalar
      // otherwise falls back to alphabetical order with no description. Keep this list in sync
      // with the `tags` used across src/modules/*/routes.ts; an admin-scoped route within a
      // module (path containing /admin/) additionally carries the shared 'Admin' tag so the FE
      // can browse either by domain or by "everything admin-only."
      tags: [
        { name: 'Auth', description: 'Registration, login, tokens, two-factor auth.' },
        {
          name: 'Users',
          description: 'Creative profiles, portfolios, employer profiles, public talent search.',
        },
        { name: 'Listings', description: 'Job postings.' },
        { name: 'Hiring', description: 'Applications, contracts, talent invitations.' },
        { name: 'Collaboration', description: 'Deliverables submitted and reviewed on a contract.' },
        { name: 'Wallet', description: "A caller's balance and ledger history." },
        { name: 'Payments', description: 'Deposits and withdrawals via Flutterwave.' },
        { name: 'Reviews', description: 'Ratings left after a contract completes.' },
        { name: 'Events', description: 'The public event board and RSVPs.' },
        { name: 'Messaging', description: 'Direct conversations between two accounts.' },
        { name: 'Notifications', description: "A caller's notification preferences." },
        { name: 'Identity (KYC)', description: 'Identity verification submissions and review.' },
        { name: 'Files', description: 'General-purpose S3-backed file upload and download.' },
        { name: 'RBAC', description: 'Roles and permission assignment.' },
        {
          name: 'Admin',
          description:
            'Every admin-only endpoint across the API, grouped here in addition to its own domain tag.',
        },
        { name: 'Audit', description: 'Read-only audit log.' },
      ],
    },
  });

  await app.register(scalarApiReference, {
    routePrefix: '/reference',
    configuration: {
      title: 'Creative Hub API',
    },
  });
});
