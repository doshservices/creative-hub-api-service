import { ForbiddenError, NotFoundError } from '../../common/errors.js';
import type { ListingDTO, ListingPage } from './dto.js';
import type { Currency, PaymentType } from './model.js';

export interface CreateListingInput {
  title: string;
  description: string;
  location: string;
  paymentType: PaymentType;
  amountMinor: number;
  currency: Currency;
  duration: string;
}

export interface ListingRepositoryPort {
  create(input: CreateListingInput & { clientAccountId: string }): Promise<ListingDTO>;
  findById(id: string): Promise<ListingDTO | null>;
  listOpen(params: { limit: number; cursor?: string }): Promise<ListingPage>;
  listByClient(
    clientAccountId: string,
    params: { limit: number; cursor?: string },
  ): Promise<ListingPage>;
  close(id: string): Promise<ListingDTO | null>;
}

export class ListingService {
  constructor(private readonly repository: ListingRepositoryPort) {}

  async create(clientAccountId: string, input: CreateListingInput): Promise<ListingDTO> {
    return this.repository.create({ ...input, clientAccountId });
  }

  async getById(listingId: string): Promise<ListingDTO> {
    const listing = await this.repository.findById(listingId);
    if (!listing) {
      throw new NotFoundError('Listing not found');
    }
    return listing;
  }

  async listOpen(params: { limit: number; cursor?: string }): Promise<ListingPage> {
    return this.repository.listOpen(params);
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
}
