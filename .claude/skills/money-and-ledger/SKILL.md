---
name: money-and-ledger
description: Wallet balances, payments, idempotency keys, holds/escrow, and reconciliation. Use when touching anything under the wallet or payments modules, or any code that reads or writes a balance.
---

# Money and ledger

## The core invariant

Balance is a derived value, never a field you patch directly. Every change to a wallet's balance
is a row in an append-only ledger collection; the balance shown to a user is
`sum(ledger entries for that wallet)` (materialized/cached, but always reconcilable back to the
ledger). If you find yourself writing `wallet.balance += amount`, stop — that's a ledger entry,
not a field update.

## Units

- All money is an integer in minor units (kobo, cents). Never `number` used as a decimal, never
  `parseFloat` on an amount, never JS arithmetic (`+`, `-`) on two balances without going through
  the ledger.
- Currency is stored alongside every amount — don't assume a single currency across the system
  even if only one is live today.

## Idempotency

- Every payment-initiating request (debit, credit, transfer, provider charge) takes an
  idempotency key from the client or generates one deterministically from the request, and the
  repository enforces it with a unique index — a retried request must resolve to the same ledger
  entry, not a duplicate one.
- Webhook handlers from payment providers are idempotent on the provider's event ID — a redelivered
  webhook must not double-credit.

## Holds and escrow

- A hold (funds reserved but not yet moved) is its own ledger entry type, not a separate mutable
  field on the wallet. Releasing or capturing a hold writes a new ledger entry that references the
  hold entry — it doesn't edit the hold in place.
- Available balance (`total - held`) is computed at read time, not stored as a separately
  maintained field that can drift from the ledger.

## Reconciliation

- Anything that talks to an external payment provider (Prembly, a bank, a card processor) writes
  a ledger entry in `pending` status on initiation and reconciles it to `settled`/`failed` from
  the provider's webhook or a polling job — never mark a payment settled purely on the synchronous
  API response, since providers can fail asynchronously after accepting the request.
- A reconciliation job comparing internal ledger totals against the provider's statement is a
  first-class scheduled job, not an afterthought — if this module doesn't have one yet and you're
  adding a new payment path, flag it rather than skipping it.

## Auditing

Every wallet movement, hold, and payment provider result writes an audit entry (see `CLAUDE.md`'s
audit invariant) in addition to the ledger entry — the audit trail is who/why, the ledger is the
balance math; they are not the same table.
