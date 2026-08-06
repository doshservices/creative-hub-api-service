import type { Collection, Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import {
  creativeProfileIndexes,
  type AvailableDay,
  type CreativeProfileDocument,
  type HourlyRateBand,
  type ProjectRateBand,
  type YearsOfExperience,
} from './model.js';
import type { CreativeProfileDTO } from './dto.js';

// Mirrors service.ts's `UpsertCreativeProfileInput` structurally — repository.ts never imports
// from service.ts, same as every other module (see auth/repository.ts).
export interface UpsertCreativeProfileData {
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

function toDTO(doc: CreativeProfileDocument): CreativeProfileDTO {
  return {
    id: doc._id.toHexString(),
    accountId: doc.accountId.toHexString(),
    primaryRole: doc.primaryRole,
    bio: doc.bio,
    profilePhotoKey: doc.profilePhotoKey,
    skills: doc.skills,
    yearsOfExperience: doc.yearsOfExperience,
    previousWorkExperience: doc.previousWorkExperience,
    portfolioFileKey: doc.portfolioFileKey,
    availableDays: doc.availableDays,
    availableToTravel: doc.availableToTravel,
    hourlyRateBand: doc.hourlyRateBand,
    projectRateBand: doc.projectRateBand,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class CreativeProfileRepository {
  private readonly collection: Collection<CreativeProfileDocument>;

  constructor(db: Db) {
    this.collection = db.collection<CreativeProfileDocument>('creativeProfiles');
  }

  async createIndexes(): Promise<void> {
    for (const index of creativeProfileIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async upsertForAccount(
    accountId: string,
    input: UpsertCreativeProfileData,
  ): Promise<CreativeProfileDTO> {
    const now = new Date();
    const accountObjectId = new ObjectId(accountId);
    const result = await this.collection.findOneAndUpdate(
      { accountId: accountObjectId },
      {
        $set: {
          primaryRole: input.primaryRole,
          bio: input.bio ?? null,
          profilePhotoKey: input.profilePhotoKey ?? null,
          skills: input.skills,
          yearsOfExperience: input.yearsOfExperience ?? null,
          previousWorkExperience: input.previousWorkExperience ?? null,
          portfolioFileKey: input.portfolioFileKey ?? null,
          availableDays: input.availableDays ?? [],
          availableToTravel: input.availableToTravel ?? null,
          hourlyRateBand: input.hourlyRateBand ?? null,
          projectRateBand: input.projectRateBand ?? null,
          updatedAt: now,
        },
        $setOnInsert: { _id: new ObjectId(), accountId: accountObjectId, createdAt: now },
      },
      { upsert: true, returnDocument: 'after' },
    );
    return toDTO(result!);
  }

  async findByAccountId(accountId: string): Promise<CreativeProfileDTO | null> {
    const doc = await this.collection.findOne(
      { accountId: new ObjectId(accountId) },
      {
        projection: {
          accountId: 1,
          primaryRole: 1,
          bio: 1,
          profilePhotoKey: 1,
          skills: 1,
          yearsOfExperience: 1,
          previousWorkExperience: 1,
          portfolioFileKey: 1,
          availableDays: 1,
          availableToTravel: 1,
          hourlyRateBand: 1,
          projectRateBand: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    );
    return doc ? toDTO(doc) : null;
  }
}
