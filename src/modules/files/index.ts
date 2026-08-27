import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { FastifyInstance } from 'fastify';
import { FileRepository } from './repository.js';
import { FileService, type DownloadUrlSignerPort, type UploadUrlSignerPort } from './service.js';
import { FileController } from './controller.js';
import { registerFilesRoutes } from './routes.js';

export { FileRepository } from './repository.js';
export type { FileRecordDTO, FileRecordPage } from './dto.js';

const UPLOAD_URL_TTL_SECONDS = 300;
const DOWNLOAD_URL_TTL_SECONDS = 300;

// Not wrapped in fastify-plugin — needs its own encapsulated context for `{ prefix: '/files' }`
// to apply, same reasoning as the other route-registering modules.
export default async function filesModule(app: FastifyInstance): Promise<void> {
  const repository = new FileRepository(app.mongo.db);
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
  const downloadSigner: DownloadUrlSignerPort = {
    async createPresignedGetUrl(key) {
      const command = new GetObjectCommand({ Bucket: app.config.s3.bucket, Key: key });
      return getSignedUrl(app.s3, command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
    },
  };

  const service = new FileService(repository, uploadSigner, downloadSigner);
  const controller = new FileController(service);
  registerFilesRoutes(app, controller);
}
