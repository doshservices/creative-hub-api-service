import type { ObjectId } from 'mongodb';

export type YearsOfExperience = '0-1' | '1-3' | '3-5' | '5-10' | '10+';
export type HourlyRateBand = '20-40' | '40-60' | '60-80' | '80-100' | '100+';
export type ProjectRateBand = '500-1000' | '1000-2500' | '2500-5000' | '5000-10000' | '10000+';
export type AvailableDay =
  'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

// One profile per account. `primaryRole` and `skills` are free-text/open-ended rather than a
// closed enum — the frontend's current option lists (dev/designer/manager, dance/photography/…)
// read as placeholder content, not a settled taxonomy for this marketplace.
export interface CreativeProfileDocument {
  _id: ObjectId;
  accountId: ObjectId;
  primaryRole: string;
  bio: string | null;
  location: string | null;
  profilePhotoKey: string | null;
  skills: string[];
  yearsOfExperience: YearsOfExperience | null;
  previousWorkExperience: string | null;
  portfolioFileKey: string | null;
  availableDays: AvailableDay[];
  availableToTravel: boolean | null;
  hourlyRateBand: HourlyRateBand | null;
  projectRateBand: ProjectRateBand | null;
  // Rating cache maintained only by the `review.created` event subscriber's atomic `$inc` (see
  // events.ts) — never read-modify-written, never set from a route. `ratingAvg` is derived from
  // these two in the DTO layer (repository.ts), not stored, so it can never drift into an
  // inconsistent float via a race — see CLAUDE.md's money/derived-value reasoning applied here.
  ratingSum: number;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const creativeProfileIndexes = [
  { key: { accountId: 1 }, name: 'accountId_unique', unique: true },
  // Supports GET /talents?category=... (prefix match against primaryRole) sorted by _id desc.
  { key: { primaryRole: 1, _id: -1 }, name: 'primaryRole_id', unique: false },
  // Supports GET /talents?location=... sorted by _id desc.
  { key: { location: 1, _id: -1 }, name: 'location_id', unique: false },
] as const;
