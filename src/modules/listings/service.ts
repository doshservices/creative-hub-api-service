import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/errors.js';
import type { ListingDTO, ListingPage, ListingStatsDTO } from './dto.js';
import type { Currency, PaymentType, ProjectType } from './model.js';
import type { PublicListingFilters } from './repository.js';

export interface CreateListingInput {
  title: string;
  description: string;
  location: string;
  category: string;
  headcount?: number;
  projectType: ProjectType;
  paymentType: PaymentType;
  budgetMinMinor: number;
  budgetMaxMinor: number;
  currency: Currency;
  duration: string;
  // Not stored: consumed here to decide the initial status. Defaults to true (immediate
  // publish) at the schema layer for backward compatibility with existing callers.
  publish?: boolean;
}

export interface UpdateListingInput {
  title?: string;
  description?: string;
  location?: string;
  category?: string;
  headcount?: number;
  projectType?: ProjectType;
  paymentType?: PaymentType;
  budgetMinMinor?: number;
  budgetMaxMinor?: number;
  currency?: Currency;
  duration?: string;
  publish?: boolean;
}

export interface ListingRepositoryPort {
  create(input: {
    clientAccountId: string;
    title: string;
    description: string;
    location: string;
    category: string;
    headcount: number;
    projectType: ProjectType;
    paymentType: PaymentType;
    budgetMinMinor: number;
    budgetMaxMinor: number;
    currency: Currency;
    duration: string;
    status: 'draft' | 'open' | 'closed';
  }): Promise<ListingDTO>;
  findById(id: string): Promise<ListingDTO | null>;
  listPublic(filters: PublicListingFilters, params: { limit: number; cursor?: string }): Promise<ListingPage>;
  listByClient(
    clientAccountId: string,
    params: { limit: number; cursor?: string },
  ): Promise<ListingPage>;
  update(
    id: string,
    patch: Partial<{
      title: string;
      description: string;
      location: string;
      category: string;
      headcount: number;
      projectType: ProjectType;
      paymentType: PaymentType;
      budgetMinMinor: number;
      budgetMaxMinor: number;
      currency: Currency;
      duration: string;
      status: 'draft' | 'open' | 'closed';
    }>,
  ): Promise<ListingDTO | null>;
  close(id: string): Promise<ListingDTO | null>;
  flag(id: string, reason: string): Promise<ListingDTO | null>;
  unflag(id: string): Promise<ListingDTO | null>;
  adjustApplicantCount(id: string, delta: number): Promise<void>;
  statsForClient(clientAccountId: string): Promise<ListingStatsDTO>;
}

export interface AuditRecorderPort {
  record(input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
  }): Promise<unknown>;
}

const DEFAULT_HEADCOUNT = 1;
// A listing can only be edited by its owner while it hasn't reached a terminal state.
const EDITABLE_STATUSES: Array<'draft' | 'open' | 'closed'> = ['draft', 'open'];

function assertValidBudgetRange(budgetMinMinor: number, budgetMaxMinor: number): void {
  if (budgetMaxMinor < budgetMinMinor) {
    throw new BadRequestError('budgetMaxMinor must be greater than or equal to budgetMinMinor');
  }
}

export class ListingService {
  constructor(
    private readonly repository: ListingRepositoryPort,
    private readonly audit: AuditRecorderPort,
  ) {}

  async create(clientAccountId: string, input: CreateListingInput): Promise<ListingDTO> {
    assertValidBudgetRange(input.budgetMinMinor, input.budgetMaxMinor);
    // publish defaults to true at the schema layer; only an explicit publish:false starts the
    // listing as a draft.
    const status = input.publish === false ? 'draft' : 'open';
    return this.repository.create({
      clientAccountId,
      title: input.title,
      description: input.description,
      location: input.location,
      category: input.category,
      headcount: input.headcount ?? DEFAULT_HEADCOUNT,
      projectType: input.projectType,
      paymentType: input.paymentType,
      budgetMinMinor: input.budgetMinMinor,
      budgetMaxMinor: input.budgetMaxMinor,
      currency: input.currency,
      duration: input.duration,
      status,
    });
  }

  async getById(listingId: string): Promise<ListingDTO> {
    const listing = await this.repository.findById(listingId);
    if (!listing) {
      throw new NotFoundError('Listing not found');
    }
    return listing;
  }

  async update(
    clientAccountId: string,
    listingId: string,
    input: UpdateListingInput,
  ): Promise<ListingDTO> {
    const listing = await this.repository.findById(listingId);
    if (!listing) {
      throw new NotFoundError('Listing not found');
    }
    if (listing.clientAccountId !== clientAccountId) {
      throw new ForbiddenError('You do not own this listing');
    }
    if (!EDITABLE_STATUSES.includes(listing.status)) {
      throw new BadRequestError('Only a draft or open listing can be edited');
    }

    const budgetMinMinor = input.budgetMinMinor ?? listing.budgetMinMinor;
    const budgetMaxMinor = input.budgetMaxMinor ?? listing.budgetMaxMinor;
    assertValidBudgetRange(budgetMinMinor, budgetMaxMinor);

    const { publish, ...rest } = input;
    const patch: Parameters<ListingRepositoryPort['update']>[1] = { ...rest };
    if (publish === true && listing.status === 'draft') {
      patch.status = 'open';
    }

    const updated = await this.repository.update(listingId, patch);
    if (!updated) {
      throw new NotFoundError('Listing not found');
    }
    return updated;
  }

  async listPublic(
    filters: PublicListingFilters,
    params: { limit: number; cursor?: string },
  ): Promise<ListingPage> {
    return this.repository.listPublic(filters, params);
  }

  async listMine(
    clientAccountId: string,
    params: { limit: number; cursor?: string },
  ): Promise<ListingPage> {
    return this.repository.listByClient(clientAccountId, params);
  }

  async close(clientAccountId: string, listingId: string): Promise<ListingDTO> {
    const listing = await this.repository.findById(listingId);
    if (!listing) {
      throw new NotFoundError('Listing not found');
    }
    if (listing.clientAccountId !== clientAccountId) {
      throw new ForbiddenError('You do not own this listing');
    }
    const closed = await this.repository.close(listingId);
    if (!closed) {
      throw new NotFoundError('Listing not found');
    }
    return closed;
  }

  // Admin override: closing someone else's listing is a distinct, unowned code path from the
  // owner-only `close` above (no ownership check — LISTINGS_MODERATE gates it at the route).
  async adminClose(adminAccountId: string, listingId: string): Promise<ListingDTO> {
    const closed = await this.repository.close(listingId);
    if (!closed) {
      throw new NotFoundError('Listing not found');
    }
    await this.audit.record({
      actorId: adminAccountId,
      action: 'listings.admin_closed',
      targetType: 'listing',
      targetId: listingId,
    });
    return closed;
  }

  async flag(adminAccountId: string, listingId: string, reason: string): Promise<ListingDTO> {
    const flagged = await this.repository.flag(listingId, reason);
    if (!flagged) {
      throw new NotFoundError('Listing not found');
    }
    await this.audit.record({
      actorId: adminAccountId,
      action: 'listings.flagged',
      targetType: 'listing',
      targetId: listingId,
    });
    return flagged;
  }

  async unflag(adminAccountId: string, listingId: string): Promise<ListingDTO> {
    const unflagged = await this.repository.unflag(listingId);
    if (!unflagged) {
      throw new NotFoundError('Listing not found');
    }
    await this.audit.record({
      actorId: adminAccountId,
      action: 'listings.unflagged',
      targetType: 'listing',
      targetId: listingId,
    });
    return unflagged;
  }

  // Cache-maintenance only — called from events.ts in response to hiring's
  // application.created/application.withdrawn events. Never called from a route.
  async adjustApplicantCount(listingId: string, delta: number): Promise<void> {
    await this.repository.adjustApplicantCount(listingId, delta);
  }

  async getStatsForClient(clientAccountId: string): Promise<ListingStatsDTO> {
    return this.repository.statsForClient(clientAccountId);
  }
}
