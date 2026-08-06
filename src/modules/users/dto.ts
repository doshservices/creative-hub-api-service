import type { AvailableDay, HourlyRateBand, ProjectRateBand, YearsOfExperience } from './model.js';

export interface CreativeProfileDTO {
  id: string;
  accountId: string;
  primaryRole: string;
  bio: string | null;
  profilePhotoKey: string | null;
  skills: string[];
  yearsOfExperience: YearsOfExperience | null;
  previousWorkExperience: string | null;
  portfolioFileKey: string | null;
  availableDays: AvailableDay[];
  availableToTravel: boolean | null;
  hourlyRateBand: HourlyRateBand | null;
  projectRateBand: ProjectRateBand | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadUrlDTO {
  key: string;
  uploadUrl: string;
}
