---
name: test-suite
description: How to test this codebase — unit vs integration boundaries, what needs Mongo/Redis up, what every new endpoint must cover. Use when writing tests or deciding what kind of test a change needs.
---

# Test suite

## Unit vs integration

- **Unit**: a service method or pure function with its dependencies (repository, provider client)
  faked. No Fastify instance, no real Mongo/Redis. Fast, run constantly.
- **Integration**: a route through the real Fastify instance against real Mongo + Redis
  (`docker compose up -d` first). This is where auth, permission, ownership, and pagination
  behavior actually gets proven — faking the repository would hide the exact bugs these checks
  exist to catch.

Don't substitute one for the other: a service tested only with a mocked repository hasn't proven
its Mongo query is correct; a route tested only at the unit level hasn't proven its schema/auth
wiring is correct.

## What every new endpoint needs

1. Happy path integration test.
2. Auth test: unauthenticated request is rejected.
3. Permission test: authenticated but lacking the permission is rejected.
4. Ownership test (if applicable): has the permission, doesn't own the resource, is rejected.
5. Validation test: at least one invalid-input case per schema-validated field that has
   non-obvious constraints.
6. Pagination test (if it lists): first page, subsequent page via `nextCursor`, empty result.

## What money/KYC/contract/permission changes need

An integration test asserting the audit entry was written, in addition to the functional
assertion — a wallet debit test that only checks the new balance hasn't proven the audit
invariant in `CLAUDE.md` holds.

## Running tests

Use the commands in `CLAUDE.md` (`pnpm test:unit`, `pnpm test:integration`, or a single file with
`pnpm test path/to/file.test.ts`). Integration tests need Mongo + Redis up first. Never report
tests as passing without having actually run them.
