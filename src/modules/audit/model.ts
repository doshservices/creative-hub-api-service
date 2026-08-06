import type { ObjectId } from 'mongodb';

// Append-only: no updatedAt, no update/delete methods on the repository — audit rows are
// never modified once written.
export interface AuditEntryDocument {
  _id: ObjectId;
  actorId: ObjectId;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export const auditEntryIndexes = [
  { key: { actorId: 1, createdAt: -1 }, name: 'actorId_createdAt' },
] as const;
