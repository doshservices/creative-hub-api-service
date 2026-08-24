import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DocumentType } from './model.js';
import type { IdentityService } from './service.js';

export interface SubmitVerificationBody {
  documentKey: string;
  documentType: DocumentType;
  documentCountry: string;
}

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
}
