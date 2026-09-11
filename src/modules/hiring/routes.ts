import type { FastifyInstance } from 'fastify';
import { PERMISSIONS } from '../../common/permissions.js';
import { objectIdSchema } from '../../common/schema.js';
import type {
  ApplicationIdParams,
  ApplyBody,
  ContractIdParams,
  HiringController,
  InvitationIdParams,
  InviteTalentBody,
  ListingIdParams,
  ListQuery,
  UpdateApplicationStatusBody,
} from './controller.js';
import {
  applicationPageResponseSchema,
  applicationResponseSchema,
  applyBodySchema,
  contractPageResponseSchema,
  contractResponseSchema,
  hiringStatsResponseSchema,
  inviteTalentBodySchema,
  invitationPageResponseSchema,
  invitationResponseSchema,
  listQuerySchema,
  updateApplicationStatusBodySchema,
} from './schema.js';

const listingIdParamSchema = {
  type: 'object',
  required: ['listingId'],
  properties: { listingId: objectIdSchema },
} as const;

const applicationIdParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: objectIdSchema },
} as const;

// Shared by every other single-resource route below (contracts/:id, invitations/:id) — same
// shape as applicationIdParamSchema, kept separate only for readability at each call site.
const idParamSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: objectIdSchema },
} as const;

export function registerHiringRoutes(app: FastifyInstance, controller: HiringController): void {
  const requireHiringApply = app.requirePermission(PERMISSIONS.HIRING_APPLY);
  const requireListingsWrite = app.requirePermission(PERMISSIONS.LISTINGS_WRITE);

  app.post<{ Body: ApplyBody }>(
    '/applications',
    {
      preHandler: [app.authenticate, requireHiringApply],
      schema: {
        tags: ['Hiring'],
        summary: 'Apply to a listing',
        description:
          '**Creative accounts only** (requires `hiring:apply`, granted to `creative` accounts by default).',
        body: applyBodySchema,
        response: { 201: applicationResponseSchema },
      },
    },
    controller.apply,
  );

  app.get<{ Querystring: ListQuery }>(
    '/applications/mine',
    {
      preHandler: [app.authenticate, requireHiringApply],
      schema: {
        tags: ['Hiring'],
        summary: "List the caller's own applications",
        description: '**Creative accounts only** (requires `hiring:apply`).',
        querystring: listQuerySchema,
        response: { 200: applicationPageResponseSchema },
      },
    },
    controller.listMyApplications,
  );

  app.get<{ Params: ListingIdParams; Querystring: ListQuery }>(
    '/listings/:listingId/applications',
    {
      preHandler: [app.authenticate, requireListingsWrite],
      schema: {
        tags: ['Hiring'],
        summary: 'List applications for a listing (owner only)',
        description: '**Client (employer) accounts only** (requires `listings:write`), owner of the listing.',
        params: listingIdParamSchema,
        querystring: listQuerySchema,
        response: { 200: applicationPageResponseSchema },
      },
    },
    controller.listApplicationsForListing,
  );

  app.put<{ Params: ApplicationIdParams; Body: UpdateApplicationStatusBody }>(
    '/applications/:id/status',
    {
      preHandler: [app.authenticate, requireListingsWrite],
      schema: {
        tags: ['Hiring'],
        summary: "Update an application's status (owner only)",
        description:
          '**Client (employer) accounts only** (requires `listings:write`), owner of the listing the application is for.',
        params: applicationIdParamSchema,
        body: updateApplicationStatusBodySchema,
        response: { 200: applicationResponseSchema },
      },
    },
    controller.updateApplicationStatus,
  );

  // Talent-owner only — ownership is checked in the service against the loaded application's
  // creativeAccountId, never a client-supplied field. Only reachable from pending/
  // interview_requested (see WITHDRAWABLE_STATUSES in service.ts).
  app.put<{ Params: ApplicationIdParams }>(
    '/applications/:id/withdraw',
    {
      preHandler: [app.authenticate, requireHiringApply],
      schema: {
        tags: ['Hiring'],
        summary: 'Withdraw an application',
        description: '**Creative accounts only** (requires `hiring:apply`), owner of the application.',
        params: applicationIdParamSchema,
        response: { 200: applicationResponseSchema },
      },
    },
    controller.withdrawApplication,
  );

  app.get<{ Querystring: ListQuery }>(
    '/contracts/mine',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Hiring'],
        summary: "List the caller's own contracts",
        description:
          "**Any account type** — both `creative` and `client` accounts see their own contracts (whichever side they're on).",
        querystring: listQuerySchema,
        response: { 200: contractPageResponseSchema },
      },
    },
    controller.listMyContracts,
  );

  // Client-owner only, only from 'active' — ownership and status are checked in the service
  // against the loaded contract. Releases escrow to the creative; see completeContract.
  app.put<{ Params: ContractIdParams }>(
    '/contracts/:id/complete',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Hiring'],
        summary: 'Complete a contract and release escrow to the creative',
        description:
          "**Client (employer) accounts only**, owner of the contract. No special permission beyond authentication — ownership is what's checked.",
        params: idParamSchema,
        response: { 200: contractResponseSchema },
      },
    },
    controller.completeContract,
  );

  // Employer invites a specific talent to their own listing — ownership of the listing is
  // checked in the service via the listings reader port, never a client-supplied clientAccountId.
  app.post<{ Params: ListingIdParams; Body: InviteTalentBody }>(
    '/listings/:listingId/invitations',
    {
      preHandler: [app.authenticate, requireListingsWrite],
      schema: {
        tags: ['Hiring'],
        summary: 'Invite a talent to a listing',
        description: '**Client (employer) accounts only** (requires `listings:write`), owner of the listing.',
        params: listingIdParamSchema,
        body: inviteTalentBodySchema,
        response: { 201: invitationResponseSchema },
      },
    },
    controller.inviteTalent,
  );

  app.get<{ Querystring: ListQuery }>(
    '/invitations/mine',
    {
      preHandler: [app.authenticate, requireHiringApply],
      schema: {
        tags: ['Hiring'],
        summary: "List the caller's own invitations",
        description: '**Creative accounts only** (requires `hiring:apply`).',
        querystring: listQuerySchema,
        response: { 200: invitationPageResponseSchema },
      },
    },
    controller.listMyInvitations,
  );

  // Talent-owner only. Creates an accepted application and funds/creates the contract via the
  // same escrow path as PUT /applications/:id/status with status 'accepted'.
  app.put<{ Params: InvitationIdParams }>(
    '/invitations/:id/accept',
    {
      preHandler: [app.authenticate, requireHiringApply],
      schema: {
        tags: ['Hiring'],
        summary: 'Accept a talent invitation',
        description: '**Creative accounts only** (requires `hiring:apply`), the invited talent.',
        params: idParamSchema,
        response: { 200: applicationResponseSchema },
      },
    },
    controller.acceptInvitation,
  );

  app.put<{ Params: InvitationIdParams }>(
    '/invitations/:id/decline',
    {
      preHandler: [app.authenticate, requireHiringApply],
      schema: {
        tags: ['Hiring'],
        summary: 'Decline a talent invitation',
        description: '**Creative accounts only** (requires `hiring:apply`), the invited talent.',
        params: idParamSchema,
        response: { 200: invitationResponseSchema },
      },
    },
    controller.declineInvitation,
  );

  // Read-only self data — no special permission beyond being authenticated. Branches on the
  // caller's own accountType (loaded server-side, never client-supplied) inside the service.
  app.get(
    '/mine/stats',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Hiring'],
        summary: "Get the caller's hiring stats (shape differs by account type)",
        description:
          '**Any account type** — the response shape differs by caller: a `creative` account gets `{ activeContracts, pendingApplications }`, a `client` account gets `{ applicantsWaiting }`.',
        response: { 200: hiringStatsResponseSchema },
      },
    },
    controller.getMyStats,
  );
}
