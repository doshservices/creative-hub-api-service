import type { Collection, Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { employerProfileIndexes, type EmployerProfileDocument } from './employer-profile.model.js';
import type { EmployerProfileDTO } from './dto.js';

export interface UpsertEmployerProfileData {
  companyName: string;
  industry?: string;
  bio?: string;
  logoFileKey?: string;
}

const EMPLOYER_PROFILE_PROJECTION = {
  accountId: 1,
  companyName: 1,
  industry: 1,
  bio: 1,
  logoFileKey: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

function toDTO(doc: EmployerProfileDocument): EmployerProfileDTO {
  return {
    id: doc._id.toHexString(),
    accountId: doc.accountId.toHexString(),
    companyName: doc.companyName,
    industry: doc.industry,
    bio: doc.bio,
    logoFileKey: doc.logoFileKey,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class EmployerProfileRepository {
  private readonly collection: Collection<EmployerProfileDocument>;

  constructor(db: Db) {
    this.collection = db.collection<EmployerProfileDocument>('employerProfiles');
  }

  async createIndexes(): Promise<void> {
    for (const index of employerProfileIndexes) {
      await this.collection.createIndex(index.key, { name: index.name, unique: index.unique });
    }
  }

  async upsertForAccount(
    accountId: string,
    input: UpsertEmployerProfileData,
  ): Promise<EmployerProfileDTO> {
    const now = new Date();
    const accountObjectId = new ObjectId(accountId);
    const result = await this.collection.findOneAndUpdate(
      { accountId: accountObjectId },
      {
        $set: {
          companyName: input.companyName,
          industry: input.industry ?? null,
          bio: input.bio ?? null,
          logoFileKey: input.logoFileKey ?? null,
          updatedAt: now,
        },
        $setOnInsert: { _id: new ObjectId(), accountId: accountObjectId, createdAt: now },
      },
      { upsert: true, returnDocument: 'after', projection: EMPLOYER_PROFILE_PROJECTION },
    );
    return toDTO(result!);
  }

  async findByAccountId(accountId: string): Promise<EmployerProfileDTO | null> {
    const doc = await this.collection.findOne(
      { accountId: new ObjectId(accountId) },
      { projection: EMPLOYER_PROFILE_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }
}
