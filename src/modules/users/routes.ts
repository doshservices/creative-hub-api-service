import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import type {
  AccountIdParams,
  CreatePortfolioItemBody,
  CreateUploadUrlBody,
  PageQuery,
  PortfolioItemIdParams,
  TalentSearchQuery,
  UpsertCreativeProfileBody,
  UpsertEmployerProfileBody,
  UsersController,
} from './controller.js';
import {
  accountIdParamsSchema,
  createPortfolioItemBodySchema,
  createUploadUrlBodySchema,
  creativeProfileResponseSchema,
  deletePortfolioItemResponseSchema,
  employerProfileResponseSchema,
  pageQuerySchema,
  portfolioItemIdParamsSchema,
  portfolioItemPageResponseSchema,
  portfolioItemResponseSchema,
  publicTalentPageResponseSchema,
  publicTalentResponseSchema,
  talentSearchQuerySchema,
  upsertCreativeProfileBodySchema,
  upsertEmployerProfileBodySchema,
  uploadUrlResponseSchema,
} from './schema.js';

export function registerUsersRoutes(app: FastifyInstance, controller: UsersController): void {
  const requireCreativeProfileWrite = app.requirePermission(PERMISSIONS.CREATIVE_PROFILE_WRITE);
  const requireEmployerProfileWrite = app.requirePermission(PERMISSIONS.EMPLOYER_PROFILE_WRITE);

  // -- Creative profile (self-service) -------------------------------------------------------

  app.get(
    '/me/creative-profile',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Users'],
        summary: "Get the authenticated creative's profile",
        description:
          '**Creative accounts.** Callable by any account type, but only a `creative` account has a profile to return (a `client` account gets 404).',
        response: { 200: creativeProfileResponseSchema },
      },
    },
    controller.getMyCreativeProfile,
  );

  app.put<{ Body: UpsertCreativeProfileBody }>(
    '/me/creative-profile',
    {
      preHandler: [app.authenticate, requireCreativeProfileWrite],
      schema: {
        tags: ['Users'],
        summary: "Create or update the authenticated creative's profile",
        description:
          "**Creative accounts only** (requires `profile:creative:write`, granted to `creative` accounts by default — a `client` account is rejected even before the accountType check runs).",
        body: upsertCreativeProfileBodySchema,
        response: { 200: creativeProfileResponseSchema },
      },
    },
    controller.upsertMyCreativeProfile,
  );

  app.post<{ Body: CreateUploadUrlBody }>(
    '/me/creative-profile/upload-url',
    {
      preHandler: [app.authenticate, requireCreativeProfileWrite],
      schema: {
        tags: ['Users'],
        summary: 'Get a presigned S3 upload URL for a profile asset',
        description: "**Creative accounts only** (requires `profile:creative:write`).",
        body: createUploadUrlBodySchema,
        response: { 201: uploadUrlResponseSchema },
      },
    },
    controller.createUploadUrl,
  );

  // -- Portfolio gallery (self-service) -------------------------------------------------------
  // GET is gated the same as GET /me/creative-profile above — `app.authenticate` only, no
  // permission required to read your own data. Writes require CREATIVE_PROFILE_WRITE.

  app.post<{ Body: CreatePortfolioItemBody }>(
    '/me/portfolio-items',
    {
      preHandler: [app.authenticate, requireCreativeProfileWrite],
      schema: {
        tags: ['Users'],
        summary: 'Add a portfolio item',
        description:
          '**Creative accounts only** (requires `profile:creative:write`). The file must already be uploaded and confirmed via the Files API.',
        body: createPortfolioItemBodySchema,
        response: { 201: portfolioItemResponseSchema },
      },
    },
    controller.addPortfolioItem,
  );

  app.get<{ Querystring: PageQuery }>(
    '/me/portfolio-items',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Users'],
        summary: "List the authenticated creative's portfolio items",
        description:
          '**Creative accounts.** Callable by any account type, but only meaningful for a `creative` account — a `client` account always gets an empty page.',
        querystring: pageQuerySchema,
        response: { 200: portfolioItemPageResponseSchema },
      },
    },
    controller.listMyPortfolioItems,
  );

  app.delete<{ Params: PortfolioItemIdParams }>(
    '/me/portfolio-items/:id',
    {
      preHandler: [app.authenticate, requireCreativeProfileWrite],
      schema: {
        tags: ['Users'],
        summary: 'Delete a portfolio item',
        description: '**Creative accounts only** (requires `profile:creative:write`), owner only.',
        params: portfolioItemIdParamsSchema,
        response: { 200: deletePortfolioItemResponseSchema },
      },
    },
    controller.deletePortfolioItem,
  );

  // -- Employer/company profile -----------------------------------------------------------------
  // Permission-gated AND service-level accountType==='client' checked against the loaded
  // account — see service.ts's assertClientAccount.

  app.get(
    '/me/employer-profile',
    {
      preHandler: [app.authenticate, requireEmployerProfileWrite],
      schema: {
        tags: ['Users'],
        summary: "Get the authenticated employer's company profile",
        description:
          "**Client (employer) accounts only** (requires `employer:profile:write`, granted to `client` accounts by default). Also enforced server-side against the loaded account's `accountType`, not just the permission.",
        response: { 200: employerProfileResponseSchema },
      },
    },
    controller.getMyEmployerProfile,
  );

  app.put<{ Body: UpsertEmployerProfileBody }>(
    '/me/employer-profile',
    {
      preHandler: [app.authenticate, requireEmployerProfileWrite],
      schema: {
        tags: ['Users'],
        summary: "Create or update the authenticated employer's company profile",
        description:
          "**Client (employer) accounts only** (requires `employer:profile:write`). Also enforced server-side against the loaded account's `accountType`.",
        body: upsertEmployerProfileBodySchema,
        response: { 200: employerProfileResponseSchema },
      },
    },
    controller.upsertMyEmployerProfile,
  );

  // -- Public talent search --------------------------------------------------------------------
  // Same pattern as listings' public `GET /` — any authenticated account can browse, no special
  // permission.

  app.get<{ Querystring: TalentSearchQuery }>(
    '/talents',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Users'],
        summary: 'Search public talent profiles',
        description:
          '**Any account type** — typically used by `client` accounts browsing to hire, but not permission-restricted (same pattern as browsing listings).',
        querystring: talentSearchQuerySchema,
        response: { 200: publicTalentPageResponseSchema },
      },
    },
    controller.searchTalents,
  );

  app.get<{ Params: AccountIdParams }>(
    '/talents/:accountId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Users'],
        summary: "Get a talent's public profile",
        description: '**Any account type.**',
        params: accountIdParamsSchema,
        response: { 200: publicTalentResponseSchema },
      },
    },
    controller.getPublicTalent,
  );

  app.get<{ Params: AccountIdParams; Querystring: PageQuery }>(
    '/talents/:accountId/portfolio-items',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Users'],
        summary: "List a talent's public portfolio items",
        description: '**Any account type.**',
        params: accountIdParamsSchema,
        querystring: pageQuerySchema,
        response: { 200: portfolioItemPageResponseSchema },
      },
    },
    controller.listPublicPortfolioItems,
  );
}
