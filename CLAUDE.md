# CLAUDE.md

Marketplace backend: **Fastify + TypeScript + MongoDB + Redis**, modular monolith.
Domains: auth, users, identity (KYC), listings, hiring, contracts, wallet, payments, messaging, collaboration, notifications, audit, rbac, files.

<!-- MAINTAINER NOTE: everything in `<!-- -->` is stripped before Claude sees it — free notes.

     This project has no package.json yet (pre-scaffold). The commands below are the intended
     pnpm scripts for when the project is bootstrapped — re-verify every one against the real
     package.json the day `pnpm init` happens, and delete this note once confirmed.
     Rule of thumb for edits: if Claude can read it from the code, delete it. Keep only
     commands, invariants, and the things Claude gets wrong without being told. Target <200 lines. -->

## Commands

| Task              | Command                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| Install           | `pnpm install`                                                           |
| Dev server        | `pnpm dev`                                                               |
| Typecheck         | `pnpm typecheck`                                                         |
| Lint              | `pnpm lint`                                                              |
| Unit tests        | `pnpm test:unit`                                                         |
| Integration tests | `pnpm test:integration` (needs Mongo + Redis up: `docker compose up -d`) |
| Single test file  | `pnpm test path/to/file.test.ts`                                         |

Run typecheck + the tests covering what you touched before reporting work as done.
Never state that tests pass without having run them; if a command can't be run here, say so.

## Layout

```
src/modules/<domain>/   routes · controller · service · repository · model · schema · dto · events · __tests__
src/plugins/            Fastify plugins (mongo, redis, auth, s3, error handler)
src/config/             env schema — all config is read here, never process.env elsewhere
src/common/  src/utils/  src/middleware/
```

A module's public surface is its `index.ts`. Cross-module imports go through `index.ts` only —
never import another module's repository, model, or internal service. If two modules need the same
logic, it moves to `src/common/` or one module emits an event the other subscribes to.

## Layering (the rule most often broken)

- **Routes**: attach schema, attach auth/permission preHandlers, call one service method, return. No business logic, no database access.
- **Services**: all business logic. Never import a Mongo model or the driver.
- **Repositories**: the only place that talks to MongoDB. Return domain objects, not raw driver results.

## Invariants

- **Pagination**: every list endpoint is cursor-paginated (`?limit=&cursor=`). No unbounded finds, no offset/skip on large collections.
- **Projections**: repositories select fields explicitly. No bare `find({})`.
- **Redis is cache/coordination only** — never a source of truth, and every key set has an explicit TTL.
- **Files never touch local disk.** Upload straight to S3; store the object _key_ in Mongo, never a signed URL.
- **Money is integer minor units** (kobo/cents). No floats, no `Number` arithmetic on balances. Balance is derived from the ledger, never patched directly.
- **Prembly (KYC) and Sendco (notifications) are never called inline in a request path** — enqueue a job and return. See the `third-party-provider` skill.
- **New dependency = ask first.** Prefer what's already in `package.json`.

## Auth and authorization

Stateless JWT access tokens; refresh tokens are stored server-side in Redis with a TTL.
Authorization is **permission-based, not role-based**: check `wallet:debit`, not `role === 'admin'`.
Every protected route verifies three things in order: authenticated → has permission → owns the resource
(ownership checked in the service, against the loaded document — not from a client-supplied `userId`).

## Validation

Every request is schema-validated at the route: body, params, query, and headers. Never read an
unvalidated field off `request`. Client-supplied `role`, `permissions`, `status`, `balance`, or
`verified` fields are stripped, never trusted.

## Errors

Throw typed errors (`AppError` subclasses) from services; a single global error handler serializes them.
Wire responses are always:

```json
{ "success": false, "message": "Invalid credentials", "error": "UNAUTHORIZED" }
```

Never surface stack traces, driver errors, or Mongo validation text to a client.

## Logging and audit

Structured logs only (pino). Redact list must cover: passwords, tokens, OTPs, secrets, keys,
BVN/NIN and other ID numbers, full card data. Log the object key, not the file.

Sensitive actions write an append-only audit entry: login, password/2FA change, wallet movement,
contract signature, KYC result, role or permission change. Audit rows are never updated or deleted.

## Definition of done

1. Typecheck and lint clean; tests written and run.
2. New endpoint has: request schema, permission check, ownership check, pagination if it lists, tests.
3. Anything touching money, KYC, contracts, or permissions also has an audit entry and an integration test.
4. Secrets stay in env config; nothing new is logged unredacted.

## Where the detail lives

Load these instead of asking; they exist so this file stays short.

- `.claude/skills/module-scaffold` — adding a new domain module
- `.claude/skills/mongo-data-layer` — repositories, indexes, aggregation, transactions
- `.claude/skills/money-and-ledger` — wallet, payments, idempotency, locks
- `.claude/skills/third-party-provider` — Prembly, Sendco, webhooks, retries
- `.claude/skills/test-suite` — how to test this codebase
- `.claude/skills/pre-pr-review` — self-review before opening a PR
- `.claude/rules/` — path-scoped conventions that load only when editing matching files
