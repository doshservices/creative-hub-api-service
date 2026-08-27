import { randomUUID } from 'node:crypto';
import { ForbiddenError, NotFoundError } from '../../common/errors.js';
import type { FileRecordDTO, FileRecordPage, UploadUrlDTO } from './dto.js';

export interface PageParams {
  limit: number;
  cursor?: string;
}

export interface CreateUploadInput {
  purpose: string;
  contentType: string;
}

export interface FileRepositoryPort {
  create(input: {
    ownerId: string;
    key: string;
    purpose: string;
    contentType: string;
  }): Promise<FileRecordDTO>;
  findById(id: string): Promise<FileRecordDTO | null>;
  listForOwner(ownerId: string, params: PageParams): Promise<FileRecordPage>;
  markConfirmed(id: string): Promise<FileRecordDTO | null>;
}

export interface UploadUrlSignerPort {
  createPresignedPutUrl(key: string, contentType: string): Promise<string>;
}

export interface DownloadUrlSignerPort {
  createPresignedGetUrl(key: string): Promise<string>;
}

export class FileService {
  constructor(
    private readonly repository: FileRepositoryPort,
    private readonly uploadSigner: UploadUrlSignerPort,
    private readonly downloadSigner: DownloadUrlSignerPort,
  ) {}

  async createUploadUrl(ownerId: string, input: CreateUploadInput): Promise<UploadUrlDTO> {
    const key = `${input.purpose}/${ownerId}/${randomUUID()}`;
    const record = await this.repository.create({
      ownerId,
      key,
      purpose: input.purpose,
      contentType: input.contentType,
    });
    const uploadUrl = await this.uploadSigner.createPresignedPutUrl(key, input.contentType);
    return { id: record.id, key: record.key, uploadUrl };
  }

  async confirmUpload(ownerId: string, fileId: string): Promise<FileRecordDTO> {
    const record = await this.getOwned(ownerId, fileId);
    if (record.status === 'confirmed') {
      return record;
    }
    const updated = await this.repository.markConfirmed(fileId);
    if (!updated) {
      throw new NotFoundError('File not found');
    }
    return updated;
  }

  async getMyFile(ownerId: string, fileId: string): Promise<FileRecordDTO> {
    return this.getOwned(ownerId, fileId);
  }

  async listMyFiles(ownerId: string, params: PageParams): Promise<FileRecordPage> {
    return this.repository.listForOwner(ownerId, params);
  }

  // A signed GET URL is generated on demand and never stored — CLAUDE.md's files invariant is
  // that Mongo holds the object key, not a URL.
  async createDownloadUrl(ownerId: string, fileId: string): Promise<{ downloadUrl: string }> {
    const record = await this.getOwned(ownerId, fileId);
    const downloadUrl = await this.downloadSigner.createPresignedGetUrl(record.key);
    return { downloadUrl };
  }

  private async getOwned(ownerId: string, fileId: string): Promise<FileRecordDTO> {
    const record = await this.repository.findById(fileId);
    if (!record) {
      throw new NotFoundError('File not found');
    }
    if (record.ownerId !== ownerId) {
      throw new ForbiddenError('You do not own this file');
    }
    return record;
  }
}
