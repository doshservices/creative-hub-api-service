import type { FastifyReply, FastifyRequest } from 'fastify';
import type { NotificationPreferencesDTO } from './dto.js';
import type { NotificationPreferencesService } from './service.js';

export type UpdatePreferencesBody = Partial<NotificationPreferencesDTO>;

export class NotificationsController {
  constructor(private readonly service: NotificationPreferencesService) {}

  getMyPreferences = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const data = await this.service.getMyPreferences(request.user.sub);
    await reply.send({ success: true, data });
  };

  updateMyPreferences = async (
    request: FastifyRequest<{ Body: UpdatePreferencesBody }>,
    reply: FastifyReply,
  ): Promise<void> => {
    const data = await this.service.updateMyPreferences(request.user.sub, request.body);
    await reply.send({ success: true, data });
  };
}
