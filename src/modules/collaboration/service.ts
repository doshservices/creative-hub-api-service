import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors.js';
import type { DeliverableDTO, DeliverablePage } from './dto.js';

export interface PageParams {
  limit: number;
  cursor?: string;
}

export interface SubmitDeliverableInput {
  fileId: string;
  note?: string;
}

export interface ReviewDeliverableInput {
  status: 'approved' | 'revision_requested';
  reviewNote?: string;
}

// Minimal read surface collaboration needs from hiring — see hiring/index.ts, the only import
// path other modules may use to reach that module.
export interface ContractReaderPort {
  findById(
    id: string,
  ): Promise<{ id: string; clientAccountId: string; creativeAccountId: string; status: string } | null>;
}

// Minimal read surface collaboration needs from files — see files/index.ts.
export interface FileReaderPort {
  findById(id: string): Promise<{ id: string; ownerId: string; status: string } | null>;
}

export interface DeliverableRepositoryPort {
  create(input: {
    contractId: string;
    clientAccountId: string;
    creativeAccountId: string;
    fileId: string;
    note?: string;
  }): Promise<DeliverableDTO>;
  findById(id: string): Promise<DeliverableDTO | null>;
  listForContract(contractId: string, params: PageParams): Promise<DeliverablePage>;
  updateReview(
    id: string,
    status: 'approved' | 'revision_requested',
    reviewNote: string | null,
  ): Promise<DeliverableDTO | null>;
}

export class CollaborationService {
  constructor(
    private readonly deliverables: DeliverableRepositoryPort,
    private readonly contracts: ContractReaderPort,
    private readonly files: FileReaderPort,
  ) {}

  async submitDeliverable(
    creativeAccountId: string,
    contractId: string,
    input: SubmitDeliverableInput,
  ): Promise<DeliverableDTO> {
    const contract = await this.contracts.findById(contractId);
    if (!contract) {
      throw new NotFoundError('Contract not found');
    }
    if (contract.creativeAccountId !== creativeAccountId) {
      throw new ForbiddenError('You are not the creative on this contract');
    }
    if (contract.status !== 'active') {
      throw new ConflictError('This contract is not active');
    }

    const file = await this.files.findById(input.fileId);
    if (!file) {
      throw new NotFoundError('File not found');
    }
    if (file.ownerId !== creativeAccountId) {
      throw new ForbiddenError('You do not own this file');
    }
    if (file.status !== 'confirmed') {
      throw new ConflictError('The file upload has not been confirmed yet');
    }

    return this.deliverables.create({
      contractId,
      clientAccountId: contract.clientAccountId,
      creativeAccountId,
      fileId: input.fileId,
      ...(input.note !== undefined ? { note: input.note } : {}),
    });
  }

  async listDeliverables(
    accountId: string,
    contractId: string,
    params: PageParams,
  ): Promise<DeliverablePage> {
    const contract = await this.contracts.findById(contractId);
    if (!contract) {
      throw new NotFoundError('Contract not found');
    }
    if (contract.clientAccountId !== accountId && contract.creativeAccountId !== accountId) {
      throw new ForbiddenError('You are not a party to this contract');
    }
    return this.deliverables.listForContract(contractId, params);
  }

  async getDeliverable(accountId: string, deliverableId: string): Promise<DeliverableDTO> {
    return this.getOwned(accountId, deliverableId);
  }

  async reviewDeliverable(
    clientAccountId: string,
    deliverableId: string,
    input: ReviewDeliverableInput,
  ): Promise<DeliverableDTO> {
    const deliverable = await this.deliverables.findById(deliverableId);
    if (!deliverable) {
      throw new NotFoundError('Deliverable not found');
    }
    if (deliverable.clientAccountId !== clientAccountId) {
      throw new ForbiddenError('You are not the client on this contract');
    }
    if (deliverable.status !== 'submitted') {
      throw new ConflictError('This deliverable has already been reviewed');
    }

    const updated = await this.deliverables.updateReview(
      deliverableId,
      input.status,
      input.reviewNote ?? null,
    );
    if (!updated) {
      throw new NotFoundError('Deliverable not found');
    }
    return updated;
  }

  private async getOwned(accountId: string, deliverableId: string): Promise<DeliverableDTO> {
    const deliverable = await this.deliverables.findById(deliverableId);
    if (!deliverable) {
      throw new NotFoundError('Deliverable not found');
    }
    if (deliverable.clientAccountId !== accountId && deliverable.creativeAccountId !== accountId) {
      throw new ForbiddenError('You are not a party to this deliverable');
    }
    return deliverable;
  }
}
