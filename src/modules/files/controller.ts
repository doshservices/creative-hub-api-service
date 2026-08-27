import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FileService, PageParams } from './service.js';

export interface CreateUploadUrlBody {
  purpose: string;
  contentType: string;
}

export interface FileIdParams {
  id: string;
}

export interface ListQuery {
  limit?: number;
  cursor?: string;
}

function pageParams(query: ListQuery): PageParams {
  return {
    limit: query.limit ?? 20,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  };
}

export class FileController {
  constructor(private readonly service: FileService) {}

  createUploadUrl = async (
    request: FastifyRequest<{ Body: CreateUploadUrlBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.createUploadUrl(request.user.sub, request.body);
    await reply.code(201).send({ success: true, data });
  };

  confirmUpload = async (
    request: FastifyRequest<{ Params: FileIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.confirmUpload(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };

  getMyFile = async (
    request: FastifyRequest<{ Params: FileIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.getMyFile(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };

  listMyFiles = async (
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.listMyFiles(request.user.sub, pageParams(request.query));
    await reply.send({ success: true, data });
  };

  createDownloadUrl = async (
    request: FastifyRequest<{ Params: FileIdParams }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.createDownloadUrl(request.user.sub, request.params.id);
    await reply.send({ success: true, data });
  };
}
