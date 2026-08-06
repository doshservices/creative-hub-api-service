---
paths:
  - 'src/modules/**/*.routes.ts'
  - 'src/modules/**/*.controller.ts'
---

# HTTP routes and controllers

- A route handler does four things in order: validate (via schema), check auth/permission,
  call one service method, shape the response. No business logic and no repository/model
  imports here — if a route is doing anything else, it belongs in the service.
- Every route has a request schema covering body, params, query, and headers. Nothing is read
  off `request` that isn't in the schema.
- Client-supplied `role`, `permissions`, `status`, `balance`, `verified`, or any other field that
  represents server-controlled state is never accepted from the request — strip it in the schema
  or the DTO, don't rely on the service to ignore it.
- Permission checks use the permission string (`wallet:debit`, `contracts:sign`), never
  `role === 'admin'`. Ownership is checked in the service against the loaded document, never
  against a client-supplied `userId`/`ownerId` in the request.
- List endpoints accept `?limit=&cursor=`, never `?page=&offset=` or an unbounded fetch-all.
- Errors are thrown as typed `AppError` subclasses and left to the global error handler — a route
  never constructs a raw `reply.code(500).send(...)` for a business-logic failure, and never lets
  a driver or validation error reach the client.
- Wire error shape is always `{ success: false, message, error }` — don't invent a different
  envelope for a new route.
