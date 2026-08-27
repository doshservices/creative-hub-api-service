import type { FileStatus } from './model.js';

export interface FileRecordDTO {
  id: string;
  ownerId: string;
  key: string;
  purpose: string;
  contentType: string;
  status: FileStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileRecordPage {
  items: FileRecordDTO[];
  nextCursor: string | null;
}

export interface UploadUrlDTO {
  id: string;
  key: string;
  uploadUrl: string;
}
