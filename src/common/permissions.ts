// Permission strings are the unit of authorization (never a role check) — see CLAUDE.md.
// Centralized here so the module that grants a permission (auth, at registration) and the
// module that requires it (e.g. users, listings, hiring) reference the same constant instead
// of duplicating string literals across module boundaries.
export const PERMISSIONS = {
  CREATIVE_PROFILE_WRITE: 'profile:creative:write',
  LISTINGS_WRITE: 'listings:write',
  HIRING_APPLY: 'hiring:apply',
  IDENTITY_VERIFY: 'identity:verify',
  PAYMENTS_INITIATE: 'payments:initiate',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
