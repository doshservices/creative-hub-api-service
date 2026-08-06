import { randomUUID } from 'node:crypto';
import { NotFoundError } from '../../common/errors.js';
import type { CreativeProfileDTO, UploadUrlDTO } from './dto.js';
import type { AvailableDay, HourlyRateBand, ProjectRateBand, YearsOfExperience } from './model.js';

export interface UpsertCreativeProfileInput {
  primaryRole: string;
  bio?: string;
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

export type UploadPurpose = 'profile-photo' | 'portfolio';

export interface CreativeProfileRepositoryPort {
  upsertForAccount(
    accountId: string,
    input: UpsertCreativeProfileInput,
  ): Promise<CreativeProfileDTO>;
  findByAccountId(accountId: string): Promise<CreativeProfileDTO | null>;
}

export interface UploadUrlSignerPort {
  createPresignedPutUrl(key: string, contentType: string): Promise<string>;
}

const UPLOAD_KEY_PREFIX: Record<UploadPurpose, string> = {
  'profile-photo': 'profile-photos',
  portfolio: 'portfolio',
};

export class CreativeProfileService {
  constructor(
    private readonly repository: CreativeProfileRepositoryPort,
    private readonly uploadSigner: UploadUrlSignerPort,
  ) {}

  async upsertOwnProfile(
    accountId: string,
    input: UpsertCreativeProfileInput,
  ): Promise<CreativeProfileDTO> {
    return this.repository.upsertForAccount(accountId, input);
  }

  async getOwnProfile(accountId: string): Promise<CreativeProfileDTO> {
    const profile = await this.repository.findByAccountId(accountId);
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
}
