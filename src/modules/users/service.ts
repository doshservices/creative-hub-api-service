import { randomUUID } from 'node:crypto';
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors.js';
import type {
  CreativeProfileDTO,
  EmployerProfileDTO,
  PortfolioItemDTO,
  PortfolioItemPage,
  PublicTalentDTO,
  PublicTalentPage,
  UploadUrlDTO,
} from './dto.js';
import type { AvailableDay, HourlyRateBand, ProjectRateBand, YearsOfExperience } from './model.js';
import type { PortfolioMediaType } from './portfolio-item.model.js';

export interface PageParams {
  limit: number;
  cursor?: string;
}

export interface UpsertCreativeProfileInput {
  primaryRole: string;
  bio?: string;
  location?: string;
  profilePhotoKey?: string;
  skills: string[];
  yearsOfExperience?: YearsOfExperience;
  previousWorkExperience?: string;
  portfolioFileKey?: string;
  availableDays?: AvailableDay[];
  availableToTravel?: boolean;
  hourlyRateBand?: HourlyRateBand;
  projectRateBand?: ProjectRateBand;
}

export interface TalentSearchInput {
  category?: string;
  location?: string;
  hourlyRateBand?: HourlyRateBand;
  availableToTravel?: boolean;
}

export interface AddPortfolioItemInput {
  fileId: string;
  mediaType: PortfolioMediaType;
  title?: string;
}

export interface UpsertEmployerProfileInput {
  companyName: string;
  industry?: string;
  bio?: string;
  logoFileKey?: string;
}

export type UploadPurpose = 'profile-photo' | 'portfolio';

export interface CreativeProfileRepositoryPort {
  upsertForAccount(
    accountId: string,
    input: UpsertCreativeProfileInput,
  ): Promise<CreativeProfileDTO>;
  findByAccountId(accountId: string): Promise<CreativeProfileDTO | null>;
  findPublicByAccountId(accountId: string): Promise<PublicTalentDTO | null>;
  findManyByAccountIds(accountIds: string[]): Promise<CreativeProfileDTO[]>;
  searchTalents(filters: TalentSearchInput, params: PageParams): Promise<PublicTalentPage>;
  incrementRating(accountId: string, rating: number): Promise<void>;
}

export interface PortfolioItemRepositoryPort {
  create(input: {
    accountId: string;
    fileId: string;
    mediaType: PortfolioMediaType;
    title?: string;
  }): Promise<PortfolioItemDTO>;
  findById(id: string): Promise<PortfolioItemDTO | null>;
  listForAccount(accountId: string, params: PageParams): Promise<PortfolioItemPage>;
  deleteById(id: string): Promise<boolean>;
}

export interface EmployerProfileRepositoryPort {
  upsertForAccount(
    accountId: string,
    input: UpsertEmployerProfileInput,
  ): Promise<EmployerProfileDTO>;
  findByAccountId(accountId: string): Promise<EmployerProfileDTO | null>;
}

// Minimal read surface this module needs from `files` — see files/index.ts, the only import
// path other modules may use to reach that module. Mirrors collaboration/service.ts's
// `FileReaderPort`, the established cross-module pattern for verifying file ownership/status.
export interface FileReaderPort {
  findById(id: string): Promise<{ id: string; ownerId: string; status: string } | null>;
}

// Minimal read surface this module needs from `auth` — used only to check accountType against
// the loaded account, never a client-supplied field, when gating the employer profile to
// 'client' accounts. See auth/index.ts.
export interface AccountReaderPort {
  findById(id: string): Promise<{ accountType: string } | null>;
}

export interface UploadUrlSignerPort {
  createPresignedPutUrl(key: string, contentType: string): Promise<string>;
}

const UPLOAD_KEY_PREFIX: Record<UploadPurpose, string> = {
  'profile-photo': 'profile-photos',
  portfolio: 'portfolio',
};

export class UsersService {
  constructor(
    private readonly creativeProfiles: CreativeProfileRepositoryPort,
    private readonly portfolioItems: PortfolioItemRepositoryPort,
    private readonly employerProfiles: EmployerProfileRepositoryPort,
    private readonly files: FileReaderPort,
    private readonly accounts: AccountReaderPort,
    private readonly uploadSigner: UploadUrlSignerPort,
  ) {}

  // -- Creative profile (self-service) -------------------------------------------------------

  async upsertOwnProfile(
    accountId: string,
    input: UpsertCreativeProfileInput,
  ): Promise<CreativeProfileDTO> {
    return this.creativeProfiles.upsertForAccount(accountId, input);
  }

  async getOwnProfile(accountId: string): Promise<CreativeProfileDTO> {
    const profile = await this.creativeProfiles.findByAccountId(accountId);
    if (!profile) {
      throw new NotFoundError('No creative profile exists for this account yet');
    }
    return profile;
  }

  async createUploadUrl(
    accountId: string,
    purpose: UploadPurpose,
    contentType: string,
  ): Promise<UploadUrlDTO> {
    const key = `${UPLOAD_KEY_PREFIX[purpose]}/${accountId}/${randomUUID()}`;
    const uploadUrl = await this.uploadSigner.createPresignedPutUrl(key, contentType);
    return { key, uploadUrl };
  }

  // -- Public talent search -------------------------------------------------------------------

  async searchTalents(filters: TalentSearchInput, params: PageParams): Promise<PublicTalentPage> {
    return this.creativeProfiles.searchTalents(filters, params);
  }

  async getPublicProfile(accountId: string): Promise<PublicTalentDTO> {
    const profile = await this.creativeProfiles.findPublicByAccountId(accountId);
    if (!profile) {
      throw new NotFoundError('Talent not found');
    }
    return profile;
  }

  // For a future admin module's composite views — batch, projected, no N+1.
  async getManyByAccountIds(accountIds: string[]): Promise<CreativeProfileDTO[]> {
    return this.creativeProfiles.findManyByAccountIds(accountIds);
  }

  // -- Rating aggregate (wired from events.ts) -------------------------------------------------

  async recordReviewRating(revieweeAccountId: string, rating: number): Promise<void> {
    await this.creativeProfiles.incrementRating(revieweeAccountId, rating);
  }

  // -- Portfolio gallery ------------------------------------------------------------------------

  async addPortfolioItem(
    accountId: string,
    input: AddPortfolioItemInput,
  ): Promise<PortfolioItemDTO> {
    const file = await this.files.findById(input.fileId);
    if (!file) {
      throw new NotFoundError('File not found');
    }
    if (file.ownerId !== accountId) {
      throw new ForbiddenError('You do not own this file');
    }
    if (file.status !== 'confirmed') {
      throw new ConflictError('The file upload has not been confirmed yet');
    }

    return this.portfolioItems.create({
      accountId,
      fileId: input.fileId,
      mediaType: input.mediaType,
      ...(input.title !== undefined ? { title: input.title } : {}),
    });
  }

  async listMyPortfolioItems(accountId: string, params: PageParams): Promise<PortfolioItemPage> {
    return this.portfolioItems.listForAccount(accountId, params);
  }

  async listPublicPortfolioItems(
    accountId: string,
    params: PageParams,
  ): Promise<PortfolioItemPage> {
    return this.portfolioItems.listForAccount(accountId, params);
  }

  async deletePortfolioItem(accountId: string, itemId: string): Promise<void> {
    const item = await this.portfolioItems.findById(itemId);
    if (!item) {
      throw new NotFoundError('Portfolio item not found');
    }
    if (item.accountId !== accountId) {
      throw new ForbiddenError('You do not own this portfolio item');
    }
    const deleted = await this.portfolioItems.deleteById(itemId);
    if (!deleted) {
      throw new NotFoundError('Portfolio item not found');
    }
  }

  // -- Employer/company profile -----------------------------------------------------------------

  async getOwnEmployerProfile(accountId: string): Promise<EmployerProfileDTO> {
    await this.assertClientAccount(accountId);
    const profile = await this.employerProfiles.findByAccountId(accountId);
    if (!profile) {
      throw new NotFoundError('No employer profile exists for this account yet');
    }
    return profile;
  }

  async upsertOwnEmployerProfile(
    accountId: string,
    input: UpsertEmployerProfileInput,
  ): Promise<EmployerProfileDTO> {
    await this.assertClientAccount(accountId);
    return this.employerProfiles.upsertForAccount(accountId, input);
  }

  // Ownership/type check against the loaded account, never a client-supplied field — a creative
  // account must never be able to create an employer profile even if it somehow held the
  // EMPLOYER_PROFILE_WRITE permission. See CLAUDE.md's auth invariant.
  private async assertClientAccount(accountId: string): Promise<void> {
    const account = await this.accounts.findById(accountId);
    if (account?.accountType !== 'client') {
      throw new ForbiddenError('Only client accounts can manage an employer profile');
    }
  }
}
