import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { FastifyInstance } from 'fastify';
import { CreativeProfileRepository } from './repository.js';
import { CreativeProfileService, type UploadUrlSignerPort } from './service.js';
import { UsersController } from './controller.js';
import { registerUsersRoutes } from './routes.js';

const UPLOAD_URL_TTL_SECONDS = 300;

// Not wrapped in fastify-plugin: this module needs its own encapsulated context so
// `{ prefix: '/users' }` applies to its routes, same reasoning as the auth module.
export default async function usersModule(app: FastifyInstance): Promise<void> {
  const repository = new CreativeProfileRepository(app.mongo.db);
  await repository.createIndexes();

  const uploadSigner: UploadUrlSignerPort = {
    async createPresignedPutUrl(key, contentType) {
      const command = new PutObjectCommand({
        Bucket: app.config.s3.bucket,
        Key: key,
        ContentType: contentType,
      });
      return getSignedUrl(app.s3, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
    },
  };

  const service = new CreativeProfileService(repository, uploadSigner);
  const controller = new UsersController(service);
  registerUsersRoutes(app, controller);
}
