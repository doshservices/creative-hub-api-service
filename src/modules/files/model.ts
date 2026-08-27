import type { ObjectId } from 'mongodb';

export type FileStatus = 'pending' | 'confirmed';

export interface FileRecordDocument {
  _id: ObjectId;
  ownerId: ObjectId;
  // The S3 object key — never a signed URL. See CLAUDE.md's files invariant.
  key: string;
  purpose: string;
  contentType: string;
  status: FileStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const fileRecordIndexes = [
  { key: { ownerId: 1, _id: -1 }, name: 'ownerId_id', unique: false },
  { key: { key: 1 }, name: 'key_unique', unique: true },
] as const;
