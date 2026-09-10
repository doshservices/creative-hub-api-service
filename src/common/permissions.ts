// Permission strings are the unit of authorization (never a role check) — see CLAUDE.md.
// Centralized here so the module that grants a permission (auth, at registration) and the
// module that requires it (e.g. users, listings, hiring) reference the same constant instead
// of duplicating string literals across module boundaries.
export const PERMISSIONS = {
  CREATIVE_PROFILE_WRITE: 'profile:creative:write',
  EMPLOYER_PROFILE_WRITE: 'employer:profile:write',
  LISTINGS_WRITE: 'listings:write',
  // Distinct from LISTINGS_WRITE (an owner's own listing): gates admin moderation of any
  // account's listing (flag/unflag/close-override) — see listings/routes.ts's /admin/* routes.
  LISTINGS_MODERATE: 'listings:moderate',
  HIRING_APPLY: 'hiring:apply',
  IDENTITY_VERIFY: 'identity:verify',
  // Distinct from IDENTITY_VERIFY (self-submit): gates the admin manual-review override
  // alongside the Prembly webhook path.
  IDENTITY_REVIEW: 'identity:review',
  PAYMENTS_INITIATE: 'payments:initiate',
  PAYMENTS_ADMIN: 'payments:admin',
  WALLET_ADMIN: 'wallet:admin',
  RBAC_MANAGE: 'rbac:manage',
  FILES_UPLOAD: 'files:upload',
  COLLABORATION_SUBMIT: 'collaboration:submit',
  COLLABORATION_REVIEW: 'collaboration:review',
  ADMIN_USERS_MANAGE: 'admin:users:manage',
  AUDIT_READ: 'audit:read',
  EVENTS_WRITE: 'events:write',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
