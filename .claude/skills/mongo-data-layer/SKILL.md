---
name: mongo-data-layer
description: Modelling documents, choosing indexes, cursor pagination, aggregation pipelines, and multi-document transactions in MongoDB. Use when writing or changing a repository, model, or any query/aggregation against Mongo.
---

# Mongo data layer

## Modelling

- One collection per aggregate root per module (e.g. `users`, `wallets`, `contracts`) — avoid
  giant polymorphic collections discriminated only by a `type` field unless the module's own
  `model.ts` already documents that shape.
- Store references by ObjectId, not embedded copies of another module's document — cross-module
  reads go through that module's repository/service, never a raw `$lookup` into another domain's
  collection.
- Timestamps (`createdAt`, `updatedAt`) on every document; audit-relevant collections are
  append-only (no `updatedAt`, no update/delete methods on the repository at all).

## Indexes

- Every query pattern the repository exposes needs a supporting index — check `explain()` if
  unsure whether a new method will collection-scan.
- Compound indexes list the equality fields before the range/sort field (Mongo's index-prefix
  rule). A cursor-paginated list sorted by `createdAt` needs `{ ...filterFields, createdAt: -1 }`.
- Unique constraints that are business rules (one wallet per user, one active contract per
  listing+hire) are enforced with a unique index, not just application-level checks — the
  application check prevents most races, the index prevents all of them.

## Cursor pagination

- Cursor encodes the sort key of the last item returned (commonly the `_id` or `createdAt` of the
  boundary document), not a page number/offset.
- Repository list methods return `{ items, nextCursor }` where `nextCursor` is `null`/`undefined`
  when there are no more results — don't make the caller guess from `items.length < limit`.

## Aggregation

- Prefer an aggregation pipeline over pulling documents into Node for grouping/summing — this
  matters most for ledger balances and reporting, where the collection is large and the result is
  small.
- `$match` first and on an indexed field, before any `$lookup` or `$group`, so the pipeline isn't
  scanning the whole collection before it narrows.
- Aggregation results still get mapped to a DTO in the repository, same as `find` results — don't
  return raw pipeline output to the service layer.

## Transactions

- Any write that must be atomic across more than one document or one collection (a ledger entry
  plus the balance it updates, a transfer touching two wallets) uses a Mongo session with
  `withTransaction`, not sequential writes with manual compensating logic.
- Keep transactions short — do reads and validation before opening the session where possible, so
  the transaction itself is just the writes.
