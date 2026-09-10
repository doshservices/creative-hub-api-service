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

// Sorted/paginated by _id descending rather than createdAt — same reasoning as every other list
// method in this codebase (ObjectIds are already time-ordered, sidestepping same-millisecond
// tie-breaking). The equality fields (actorId, action) come before the sort key so each covers
// its filtered query as a compound-index prefix.
export const auditEntryIndexes = [
  { key: { actorId: 1, _id: -1 }, name: 'actorId_id' },
  { key: { action: 1, _id: -1 }, name: 'action_id' },
] as const;
