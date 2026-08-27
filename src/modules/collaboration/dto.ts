import type { DeliverableStatus } from './model.js';

export interface DeliverableDTO {
  id: string;
  contractId: string;
  clientAccountId: string;
  creativeAccountId: string;
  fileId: string;
  note: string | null;
  status: DeliverableStatus;
  reviewNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliverablePage {
  items: DeliverableDTO[];
  nextCursor: string | null;
}
