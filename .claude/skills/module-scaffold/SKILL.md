---
name: module-scaffold
description: Add a new domain module end to end (auth, users, listings, wallet, etc.) — folder layout, the routes -> service -> repository chain, schema/DTO, and wiring into the app. Use when asked to create a new module or a new domain from scratch.
---

# Module scaffold

A module is a self-contained folder under `src/modules/<domain>/`. Nothing outside the module
touches its internals except through `index.ts`.

## Files to create, in this order

1. **`model.ts`** — the Mongo document shape (TypeScript interface/type) and index definitions.
2. **`schema.ts`** — request/response JSON schemas (Fastify schema objects) for every route.
3. **`dto.ts`** — the shapes services and controllers pass around; map model -> DTO here so
   internal fields (e.g. raw balances, internal flags) never leak to the wire by accident.
4. **`repository.ts`** — the only file that imports the Mongo driver or `model.ts`. Methods take
   and return domain objects/DTOs, never raw driver types. List methods take `{ limit, cursor }`.
5. **`service.ts`** — business logic. Calls the repository, never a Mongo driver method directly.
   Ownership and permission decisions that depend on loaded data live here, not in the route.
6. **`controller.ts`** — thin: pull validated input, call one service method, return.
7. **`routes.ts`** — registers each endpoint with its schema, auth/permission preHandlers, and
   controller method. No logic beyond that wiring.
8. **`events.ts`** (only if this module emits or consumes events) — define the event payload
   types; other modules subscribe here rather than importing this module's service.
9. **`__tests__/`** — at minimum one integration test per route and one unit test per non-trivial
   service method. See the `test-suite` skill.
10. **`index.ts`** — re-exports the module's public surface (typically the router and any types
    other modules legitimately need). This is the only import path other modules may use.

## Wiring in

- Register the module's router in the app's plugin registration alongside the existing modules.
- If the module needs a new permission string, add it to the RBAC permission list and reference
  it by name in `routes.ts` — never inline a role check.
- If the module writes sensitive actions (auth, money, KYC, contracts, permission changes), add
  the audit-entry write in the service method, not the route.

## Before calling it done

- Every route: schema + auth + permission + ownership check (if applicable) + pagination (if it
  lists) + tests. This is the same checklist as `CLAUDE.md`'s Definition of Done — a new module
  doesn't get a lighter bar than an existing one.
