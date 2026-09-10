import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { FastifyInstance } from 'fastify';
import { AccountRepository } from '../auth/index.js';
import { FileRepository } from '../files/index.js';
import { CreativeProfileRepository } from './repository.js';
import { PortfolioItemRepository } from './portfolio-item.repository.js';
import { EmployerProfileRepository } from './employer-profile.repository.js';
import { UsersService, type UploadUrlSignerPort } from './service.js';
import { UsersController } from './controller.js';
import { registerUsersRoutes } from './routes.js';
import { registerUserEventSubscriptions } from './events.js';

export type { CreativeProfileDTO, PublicTalentDTO, PublicTalentPage } from './dto.js';

const UPLOAD_URL_TTL_SECONDS = 300;

// Not wrapped in fastify-plugin: this module needs its own encapsulated context so
// `{ prefix: '/users' }` applies to its routes, same reasoning as the auth module.
export default async function usersModule(app: FastifyInstance): Promise<void> {
  const repository = new CreativeProfileRepository(app.mongo.db);
  await repository.createIndexes();

  const portfolioItemRepository = new PortfolioItemRepository(app.mongo.db);
  await portfolioItemRepository.createIndexes();

  const employerProfileRepository = new EmployerProfileRepository(app.mongo.db);
  await employerProfileRepository.createIndexes();

  // Cross-module reads through each module's public surface (its index.ts), never its
  // repository/model directly — same pattern as collaboration reading hiring/files.
  const fileRepository = new FileRepository(app.mongo.db);
  const accountRepository = new AccountRepository(app.mongo.db);

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

  const service = new UsersService(
    repository,
    portfolioItemRepository,
    employerProfileRepository,
    fileRepository,
    accountRepository,
    uploadSigner,
  );
  const controller = new UsersController(service);
  registerUsersRoutes(app, controller);

  // Rating-aggregate subscriber — see events.ts. `reviews` (the future publisher) doesn't exist
  // yet, so this simply won't fire until that module is built.
  registerUserEventSubscriptions(app, service);
}
