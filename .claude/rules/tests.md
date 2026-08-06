---
paths:
  - 'src/**/*.test.ts'
---

# Tests

- Integration tests hit real Mongo and Redis (via `docker compose up -d`), never a mocked driver
  or an in-memory substitute — a mock/real divergence is exactly the kind of bug this suite
  exists to catch.
- Unit tests exercise services and pure logic with the repository/provider layer faked; they
  don't spin up Mongo/Redis and don't import Fastify.
- Anything touching money, KYC, contracts, or permissions gets an integration test, not just a
  unit test — assert the audit row was written, not just the primary write.
- Test the ownership and permission checks explicitly: one test proves a user without the
  permission is rejected, one proves a user with the permission but not the resource owner is
  rejected. Don't only test the happy path.
- Pagination tests assert on `nextCursor` behavior (first page, last page, empty result) — not
  just that `limit` is respected.
- Every new endpoint or repository method ships with a test in the same PR; don't leave test
  coverage as a follow-up.
