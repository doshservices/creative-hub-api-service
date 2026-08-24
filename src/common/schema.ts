// Every id/cursor a client can supply that a repository turns into `new ObjectId(x)` must carry
// this pattern in its route schema. Without it, a malformed value reaches the Mongo driver and
// throws an unhandled BSONError (500) instead of failing ajv validation (400).
export const objectIdSchema = {
  type: 'string',
  pattern: '^[a-f0-9]{24}$',
} as const;
