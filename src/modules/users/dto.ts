import type { AvailableDay, HourlyRateBand, ProjectRateBand, YearsOfExperience } from './model.js';
import type { PortfolioMediaType } from './portfolio-item.model.js';

export interface CreativeProfileDTO {
  id: string;
  accountId: string;
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
  // Derived from ratingSum/ratingCount at read time — never stored, never client-settable. See
  // model.ts.
  ratingAvg: number | null;
  ratingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// The public talent-search/profile surface — deliberately narrower than CreativeProfileDTO.
// Excludes yearsOfExperience/previousWorkExperience/portfolioFileKey (not part of the public
// browsing spec) and any auth-owned field (name/email live on the account, not this profile;
// see users/service.ts for why this module doesn't join across to fetch a display name).
export interface PublicTalentDTO {
  accountId: string;
  primaryRole: string;
  location: string | null;
  bio: string | null;
  profilePhotoKey: string | null;
  skills: string[];
  availableDays: AvailableDay[];
  availableToTravel: boolean | null;
  hourlyRateBand: HourlyRateBand | null;
  projectRateBand: ProjectRateBand | null;
  ratingAvg: number | null;
  ratingCount: number;
}

export interface PublicTalentPage {
  items: PublicTalentDTO[];
  nextCursor: string | null;
}

export interface UploadUrlDTO {
  key: string;
  uploadUrl: string;
}

export interface PortfolioItemDTO {
  id: string;
  accountId: string;
  fileId: string;
  mediaType: PortfolioMediaType;
  title: string | null;
  createdAt: Date;
}

export interface PortfolioItemPage {
  items: PortfolioItemDTO[];
  nextCursor: string | null;
}

export interface EmployerProfileDTO {
  id: string;
  accountId: string;
  companyName: string;
  industry: string | null;
  bio: string | null;
  logoFileKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}
