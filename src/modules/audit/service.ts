import type { AuditEntryDTO } from './dto.js';
import type { CreateAuditEntryInput } from './repository.js';

export interface AuditWriterPort {
  create(input: CreateAuditEntryInput): Promise<AuditEntryDTO>;
}

export class AuditService {
  constructor(private readonly repository: AuditWriterPort) {}

  async record(input: CreateAuditEntryInput): Promise<AuditEntryDTO> {
    return this.repository.create(input);
  }
}
