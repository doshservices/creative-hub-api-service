---
name: third-party-provider
description: Integrating Prembly (KYC), Sendco (notifications), or any other third-party provider — async job dispatch, webhook handling, retries, and secrets. Use when adding or changing a call to an external provider.
---

# Third-party providers

## Never inline

Prembly and Sendco calls (and any future external HTTP provider) are never awaited inside a
request handler. The route/service enqueues a job and returns; a worker makes the actual call.
This applies even to calls that are usually fast — provider latency and downtime are not the
user's problem to wait on.

## Job dispatch

- The job payload contains only what the worker needs to make the call and record the result
  (an internal reference ID, not a duplicate copy of sensitive data already in Mongo).
- Jobs are retried with backoff on transient failure (timeout, 5xx, connection error) and are
  _not_ retried on a provider's definitive rejection (4xx business validation) — retrying a
  rejected KYC check or a bounced notification indefinitely just wastes calls.
- Cap retries and land failed jobs somewhere inspectable (a dead-letter state on the job, or the
  domain record moves to a `failed`/`needs_review` status) — a job that silently disappears after
  exhausting retries is a support ticket waiting to happen.

## Webhooks

- Verify the provider's signature before trusting the payload — Prembly and Sendco webhooks both
  include a signing mechanism; check it against the raw body, not the parsed JSON, if the
  provider's HMAC is computed over the raw bytes.
- Webhook handlers are idempotent on the provider's event/reference ID — a redelivered webhook
  updates the same record, not a new one.
- A webhook handler's job is to update internal state and enqueue any follow-up (e.g. notify the
  user their KYC passed) — it is not the place for the original business logic.

## Secrets and config

- Provider API keys and webhook secrets are read from `src/config/` (the env schema), never
  inlined or read from `process.env` at the call site.
- Never log a request/response body to a provider verbatim — redact per the logging rules in
  `CLAUDE.md` (BVN/NIN, card data, tokens) even in debug logs.

## Failure visibility

If a provider call fails and the surrounding feature has no retry/alerting path yet, say so when
implementing rather than silently leaving it best-effort — money, KYC, and contract-signature
paths in particular should never fail silently.
