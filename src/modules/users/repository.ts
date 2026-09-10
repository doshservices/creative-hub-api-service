import type { Collection, Db, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import {
  creativeProfileIndexes,
  type AvailableDay,
  type CreativeProfileDocument,
  type HourlyRateBand,
  type ProjectRateBand,
  type YearsOfExperience,
} from './model.js';
import type { CreativeProfileDTO, PublicTalentDTO, PublicTalentPage } from './dto.js';

// Mirrors service.ts's `UpsertCreativeProfileInput` structurally — repository.ts never imports
// from service.ts, same as every other module (see auth/repository.ts).
export interface UpsertCreativeProfileData {
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

export interface TalentSearchFilters {
  category?: string;
  location?: string;
  hourlyRateBand?: HourlyRateBand;
  availableToTravel?: boolean;
}

export interface PageParams {
  limit: number;
  cursor?: string;
}

const CREATIVE_PROFILE_PROJECTION = {
  accountId: 1,
  primaryRole: 1,
  bio: 1,
  location: 1,
  profilePhotoKey: 1,
  skills: 1,
  yearsOfExperience: 1,
  previousWorkExperience: 1,
  portfolioFileKey: 1,
  availableDays: 1,
  availableToTravel: 1,
  hourlyRateBand: 1,
  projectRateBand: 1,
  ratingSum: 1,
  ratingCount: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

const PUBLIC_TALENT_PROJECTION = {
  accountId: 1,
  primaryRole: 1,
  location: 1,
  bio: 1,
  profilePhotoKey: 1,
  skills: 1,
  availableDays: 1,
  availableToTravel: 1,
  hourlyRateBand: 1,
  projectRateBand: 1,
  ratingSum: 1,
  ratingCount: 1,
} as const;

function ratingAvg(doc: Pick<CreativeProfileDocument, 'ratingSum' | 'ratingCount'>): number | null {
  return doc.ratingCount > 0 ? doc.ratingSum / doc.ratingCount : null;
}

function toDTO(doc: CreativeProfileDocument): CreativeProfileDTO {
  return {
    id: doc._id.toHexString(),
    accountId: doc.accountId.toHexString(),
    primaryRole: doc.primaryRole,
    bio: doc.bio,
    location: doc.location,
    profilePhotoKey: doc.profilePhotoKey,
    skills: doc.skills,
    yearsOfExperience: doc.yearsOfExperience,
    previousWorkExperience: doc.previousWorkExperience,
    portfolioFileKey: doc.portfolioFileKey,
    availableDays: doc.availableDays,
    availableToTravel: doc.availableToTravel,
    hourlyRateBand: doc.hourlyRateBand,
    projectRateBand: doc.projectRateBand,
    ratingAvg: ratingAvg(doc),
    ratingCount: doc.ratingCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toPublicDTO(
  doc: Pick<
    CreativeProfileDocument,
    | 'accountId'
    | 'primaryRole'
    | 'location'
    | 'bio'
    | 'profilePhotoKey'
    | 'skills'
    | 'availableDays'
    | 'availableToTravel'
    | 'hourlyRateBand'
    | 'projectRateBand'
    | 'ratingSum'
    | 'ratingCount'
  >,
): PublicTalentDTO {
  return {
    accountId: doc.accountId.toHexString(),
    primaryRole: doc.primaryRole,
    location: doc.location,
    bio: doc.bio,
    profilePhotoKey: doc.profilePhotoKey,
    skills: doc.skills,
    availableDays: doc.availableDays,
    availableToTravel: doc.availableToTravel,
    hourlyRateBand: doc.hourlyRateBand,
    projectRateBand: doc.projectRateBand,
    ratingAvg: ratingAvg(doc),
    ratingCount: doc.ratingCount,
  };
}

// A regex special character in a user-supplied `category` would otherwise be interpreted by
// Mongo's $regex operator instead of matched literally.
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, (match) => `\\${match}`);
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
          location: input.location ?? null,
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
        // ratingSum/ratingCount are never touched by an upsert — only set once, on insert, and
        // from then on only ever changed by incrementRating's atomic $inc. See model.ts.
        $setOnInsert: {
          _id: new ObjectId(),
          accountId: accountObjectId,
          ratingSum: 0,
          ratingCount: 0,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after', projection: CREATIVE_PROFILE_PROJECTION },
    );
    return toDTO(result!);
  }

  async findByAccountId(accountId: string): Promise<CreativeProfileDTO | null> {
    const doc = await this.collection.findOne(
      { accountId: new ObjectId(accountId) },
      { projection: CREATIVE_PROFILE_PROJECTION },
    );
    return doc ? toDTO(doc) : null;
  }

  async findPublicByAccountId(accountId: string): Promise<PublicTalentDTO | null> {
    const doc = await this.collection.findOne(
      { accountId: new ObjectId(accountId) },
      { projection: PUBLIC_TALENT_PROJECTION },
    );
    return doc ? toPublicDTO(doc) : null;
  }

  // Batch, projected — for a future admin module's composite views (see users/index.ts export).
  // Bounded by accountIds.length, not an unbounded find({}).
  async findManyByAccountIds(accountIds: string[]): Promise<CreativeProfileDTO[]> {
    if (accountIds.length === 0) {
      return [];
    }
    const docs = await this.collection
      .find(
        { accountId: { $in: accountIds.map((id) => new ObjectId(id)) } },
        { projection: CREATIVE_PROFILE_PROJECTION },
      )
      .toArray();
    return docs.map(toDTO);
  }

  // `category` matches `primaryRole` by case-sensitive prefix (anchored $regex, no `i` flag) so
  // the `primaryRole_id` index can still serve it as a range scan — a case-insensitive match
  // would force a full collection scan. `location` is an exact match (values come from a fixed
  // picklist on the client, not free text). Mongo can only use one index per query stage without
  // `$or`, so at most one of category/location drives the index; the other filter (plus
  // hourlyRateBand/availableToTravel, both low-cardinality and not worth a dedicated index) is
  // applied as a residual filter on the scanned docs — still bounded by `limit`, never unbounded.
  async searchTalents(filters: TalentSearchFilters, params: PageParams): Promise<PublicTalentPage> {
    const filter: Filter<CreativeProfileDocument> = {};
    if (filters.category) {
      filter.primaryRole = { $regex: `^${escapeRegex(filters.category)}` };
    }
    if (filters.location) {
      filter.location = filters.location;
    }
    if (filters.hourlyRateBand) {
      filter.hourlyRateBand = filters.hourlyRateBand;
    }
    if (filters.availableToTravel !== undefined) {
      filter.availableToTravel = filters.availableToTravel;
    }
    if (params.cursor) {
      filter._id = { $lt: new ObjectId(params.cursor) };
    }

    const docs = await this.collection
      .find(filter, { projection: PUBLIC_TALENT_PROJECTION })
      .sort({ _id: -1 })
      .limit(params.limit + 1)
      .toArray();

    const hasMore = docs.length > params.limit;
    const items = docs.slice(0, params.limit).map(toPublicDTO);
    const last = docs[Math.min(docs.length, params.limit) - 1];
    return { items, nextCursor: hasMore && last ? last._id.toHexString() : null };
  }

  // Single atomic increment, no read-modify-write — see events.ts. Best-effort: if no profile
  // matches yet (e.g. the reviewee hasn't created one), this is a silent no-op, same as any other
  // cache-maintenance event per src/common/event-bus.ts.
  async incrementRating(accountId: string, rating: number): Promise<void> {
    await this.collection.updateOne(
      { accountId: new ObjectId(accountId) },
      { $inc: { ratingSum: rating, ratingCount: 1 }, $set: { updatedAt: new Date() } },
    );
  }
}
