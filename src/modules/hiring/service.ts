import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors.js';
import type { ApplicationStatus } from './application.model.js';
import type { ApplicationDTO, ApplicationPage, ContractDTO, ContractPage } from './dto.js';

export interface ApplyInput {
  listingId: string;
  message?: string;
}

export interface PageParams {
  limit: number;
  cursor?: string;
}

// Minimal read surface hiring needs from listings — see listings/index.ts, the only import
// path other modules may use to reach that module.
export interface ListingReaderPort {
  findById(id: string): Promise<{ id: string; clientAccountId: string; status: string } | null>;
}

export interface ApplicationRepositoryPort {
  create(input: {
    listingId: string;
    clientAccountId: string;
    creativeAccountId: string;
    message?: string;
  }): Promise<ApplicationDTO>;
  findById(id: string): Promise<ApplicationDTO | null>;
  findByListingAndCreative(
    listingId: string,
    creativeAccountId: string,
  ): Promise<ApplicationDTO | null>;
  listByCreative(creativeAccountId: string, params: PageParams): Promise<ApplicationPage>;
  listByListing(listingId: string, params: PageParams): Promise<ApplicationPage>;
  updateStatus(id: string, status: ApplicationStatus): Promise<ApplicationDTO | null>;
}

export interface ContractRepositoryPort {
  create(input: {
    listingId: string;
    applicationId: string;
    clientAccountId: string;
    creativeAccountId: string;
  }): Promise<ContractDTO>;
  listForAccount(accountId: string, params: PageParams): Promise<ContractPage>;
}

export interface AuditRecorderPort {
  record(input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
  }): Promise<unknown>;
}

// Once an application reaches one of these, a client can no longer change it further.
const TERMINAL_STATUSES: ApplicationStatus[] = ['accepted', 'rejected'];

export class HiringService {
  constructor(
    private readonly applications: ApplicationRepositoryPort,
    private readonly contracts: ContractRepositoryPort,
    private readonly listings: ListingReaderPort,
    private readonly audit: AuditRecorderPort,
  ) {}

  async apply(creativeAccountId: string, input: ApplyInput): Promise<ApplicationDTO> {
    const listing = await this.listings.findById(input.listingId);
    if (!listing) {
      throw new NotFoundError('Listing not found');
    }
    if (listing.status !== 'open') {
      throw new ConflictError('This listing is no longer open');
    }

    const existing = await this.applications.findByListingAndCreative(
      input.listingId,
      creativeAccountId,
    );
    if (existing) {
      throw new ConflictError('You have already applied to this listing');
    }

    return this.applications.create({
      listingId: input.listingId,
      clientAccountId: listing.clientAccountId,
      creativeAccountId,
      ...(input.message !== undefined ? { message: input.message } : {}),
    });
  }

  async listMyApplications(
    creativeAccountId: string,
    params: PageParams,
  ): Promise<ApplicationPage> {
    return this.applications.listByCreative(creativeAccountId, params);
  }

  async listApplicationsForListing(
    clientAccountId: string,
    listingId: string,
    params: PageParams,
  ): Promise<ApplicationPage> {
    const listing = await this.listings.findById(listingId);
    if (!listing) {
      throw new NotFoundError('Listing not found');
    }
    if (listing.clientAccountId !== clientAccountId) {
      throw new ForbiddenError('You do not own this listing');
    }
    return this.applications.listByListing(listingId, params);
  }

  async updateApplicationStatus(
    clientAccountId: string,
    applicationId: string,
    status: ApplicationStatus,
  ): Promise<ApplicationDTO> {
    const application = await this.applications.findById(applicationId);
    if (!application) {
      throw new NotFoundError('Application not found');
    }
    if (application.clientAccountId !== clientAccountId) {
      throw new ForbiddenError('You do not own the listing this application is for');
    }
    if (TERMINAL_STATUSES.includes(application.status)) {
      throw new ConflictError('This application has already reached a final decision');
    }

    const updated = await this.applications.updateStatus(applicationId, status);
    if (!updated) {
      throw new NotFoundError('Application not found');
    }

    if (status === 'accepted') {
      const contract = await this.contracts.create({
        listingId: updated.listingId,
        applicationId: updated.id,
        clientAccountId: updated.clientAccountId,
        creativeAccountId: updated.creativeAccountId,
      });
      await this.audit.record({
        actorId: clientAccountId,
        action: 'hiring.contract_created',
        targetType: 'contract',
        targetId: contract.id,
      });
    }

    return updated;
  }

  async listMyContracts(accountId: string, params: PageParams): Promise<ContractPage> {
    return this.contracts.listForAccount(accountId, params);
  }
}
