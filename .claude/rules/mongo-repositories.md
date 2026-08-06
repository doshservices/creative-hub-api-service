---
paths:
  - 'src/modules/**/*.repository.ts'
  - 'src/modules/**/*.model.ts'
---

# Mongo repositories and models

- A repository is the only file in its module allowed to import the MongoDB driver or the
  module's model. Services, controllers, and routes never touch Mongo directly — if you're
  tempted to `import { Collection }` outside a `*.repository.ts`, stop and add a repository method.
- Every `find`/`findOne`/aggregation specifies a projection. No bare `find({})` — select the
  fields the caller actually needs.
- Every list method takes `{ limit, cursor }` and returns `{ items, nextCursor }`. No `skip()`
  on a collection that can grow past a few hundred documents.
- Repository methods return domain objects (plain types the service layer understands), never
  the raw driver result (`InsertOneResult`, `WithId<Document>`, etc.) — map at the boundary.
- Indexes are declared next to the model they serve, not created ad hoc in migrations or scripts.
  A new query pattern (new filter field, new sort) needs an index reviewed alongside it.
- Money fields are integer minor units (`amountMinor`, `balanceMinor`) — never `number` treated
  as decimal currency, never driven through JS floating point arithmetic.
- Multi-document writes that must be atomic (e.g. a transfer touching two wallets) use a Mongo
  session/transaction — never sequential independent writes with a manual rollback.
