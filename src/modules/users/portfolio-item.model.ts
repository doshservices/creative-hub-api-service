import type { ObjectId } from 'mongodb';

export type PortfolioMediaType = 'video' | 'image' | 'audio' | 'doc';

// One item per uploaded work sample. `fileId` references a `files` module record — this module
// never duplicates S3/upload logic, it only verifies (via files' index.ts) that the file belongs
// to the caller and is upload-confirmed before recording it here.
export interface PortfolioItemDocument {
  _id: ObjectId;
  accountId: ObjectId;
  fileId: ObjectId;
  mediaType: PortfolioMediaType;
  title: string | null;
  createdAt: Date;
}

export const portfolioItemIndexes = [
  // Supports both the owner's own list and the public gallery list, both paginated newest-first.
  { key: { accountId: 1, _id: -1 }, name: 'accountId_id', unique: false },
] as const;
