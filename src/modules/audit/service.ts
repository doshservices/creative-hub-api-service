import type { AuditEntryDTO, AuditEntryPage } from './dto.js';
import type { AuditEntryListParams, CreateAuditEntryInput } from './repository.js';

export interface AuditWriterPort {
  create(input: CreateAuditEntryInput): Promise<AuditEntryDTO>;
  list(params: AuditEntryListParams): Promise<AuditEntryPage>;
}

export class AuditService {
  constructor(private readonly repository: AuditWriterPort) {}

  async record(input: CreateAuditEntryInput): Promise<AuditEntryDTO> {
    return this.repository.create(input);
  }

  // Admin audit-log viewer (GET /admin/audit) — read-only, never exposes an update/delete path.
  async list(params: AuditEntryListParams): Promise<AuditEntryPage> {
    return this.repository.list(params);
  }
}
