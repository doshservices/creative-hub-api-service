export interface AuditEntryDTO {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditEntryPage {
  items: AuditEntryDTO[];
  nextCursor: string | null;
}
