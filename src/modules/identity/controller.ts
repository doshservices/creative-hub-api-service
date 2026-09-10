import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DocumentType, KycStatus } from './model.js';
import type { IdentityService } from './service.js';

export interface SubmitVerificationBody {
  documentKey: string;
  documentType: DocumentType;
  documentCountry: string;
}

export interface ListVerificationsQuery {
  status?: KycStatus;
  limit?: number;
  cursor?: string;
}

export interface VerificationIdParams {
  id: string;
}

export interface RejectVerificationBody {
  reason?: string;
}

const DEFAULT_LIMIT = 20;

export class IdentityController {
  constructor(private readonly service: IdentityService) {}

  submitVerification = async (
    request: FastifyRequest<{ Body: SubmitVerificationBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.submitVerification(request.user.sub, request.body);
    await reply.code(201).send({ success: true, data });
  };

  getMyVerification = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const data = await this.service.getMyVerification(request.user.sub);
    await reply.send({ success: true, data });
  };

  listVerifications = async (
    request: FastifyRequest<{ Querystring: ListVerificationsQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const { status, limit, cursor } = request.query;
    const data = await this.service.listVerifications({
      limit: limit ?? DEFAULT_LIMIT,
      ...(status ? { status } : {}),
      ...(cursor ? { cursor } : {}),
    });
    await reply.send({ success: true, data });
  };

  approveVerification = async (
    request: FastifyRequest<{ Params: VerificationIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.approveVerification(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };

  rejectVerification = async (
    request: FastifyRequest<{ Params: VerificationIdParams; Body: RejectVerificationBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.rejectVerification(
      request.user.sub,
      request.params.id,
      request.body?.reason ?? null,
    );
    await reply.send({ success: true, data });
  };
}
