---
name: pre-pr-review
description: Self-review checklist to run before opening a PR or declaring work done — layering, invariants, tests, and the Definition of Done from CLAUDE.md. Use before reporting a task as complete or opening a pull request.
---

# Pre-PR review

Run through this before saying a change is done. It's the same bar `CLAUDE.md`'s Definition of
Done sets, expanded into concrete checks.

## Layering

- No repository/model import outside `*.repository.ts` (check `src/modules/<domain>/`, not just
  the files you touched — a service that started importing the model directly is a regression).
- No business logic in a route or controller — one service call, then shape the response.
- No cross-module import except through another module's `index.ts`.

## Invariants

- Every list endpoint touched is cursor-paginated; no `skip()`/offset added.
- Every changed query has an explicit projection; no new `find({})`.
- Every changed money path uses integer minor units and goes through the ledger, not a direct
  balance field update.
- Every new Redis key has a TTL.
- No file upload path writes to local disk.
- No inline provider call in a request path — enqueue a job.

## Auth and validation

- Every new/changed route: schema on body/params/query/headers, permission check by permission
  string, ownership check against the loaded document (not a client-supplied ID).
- No client-writable field (`role`, `permissions`, `status`, `balance`, `verified`) is read
  unvalidated from the request.

## Errors and logging

- Errors are typed `AppError` subclasses; no raw stack trace, driver error, or Mongo validation
  message can reach a client.
- Nothing new is logged unredacted (passwords, tokens, OTPs, secrets, BVN/NIN, full card data).

## Tests

- Typecheck and lint clean (`pnpm typecheck`, `pnpm lint`).
- Tests written and actually run for what changed — see the `test-suite` skill for what's
  required per endpoint.
- Money/KYC/contract/permission changes have an audit-entry assertion, not just a functional one.

## Before opening the PR

State plainly which of the above you verified by running something vs. reading the code — don't
claim a test suite passed if it wasn't run in this session.
