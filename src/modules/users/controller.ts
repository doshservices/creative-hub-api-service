import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AvailableDay, HourlyRateBand, ProjectRateBand, YearsOfExperience } from './model.js';
import type { CreativeProfileService, UploadPurpose } from './service.js';

export interface UpsertCreativeProfileBody {
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

export interface CreateUploadUrlBody {
  purpose: UploadPurpose;
  contentType: string;
}

export class UsersController {
  constructor(private readonly service: CreativeProfileService) {}

  getMyCreativeProfile = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const data = await this.service.getOwnProfile(request.user.sub);
    await reply.send({ success: true, data });
  };

  upsertMyCreativeProfile = async (
    request: FastifyRequest<{ Body: UpsertCreativeProfileBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.upsertOwnProfile(request.user.sub, request.body);
    await reply.send({ success: true, data });
  };

  createUploadUrl = async (
    request: FastifyRequest<{ Body: CreateUploadUrlBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.createUploadUrl(
      request.user.sub,
      request.body.purpose,
      request.body.contentType,
    );
    await reply.code(201).send({ success: true, data });
  };
}
