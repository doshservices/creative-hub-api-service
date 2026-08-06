import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Redis } from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { KycVerificationRepository } from './repository.js';
import { HmacWebhookSignatureVerifier, HttpPremblyClient } from './provider.js';
import { createKycQueue, createKycWorker, type DocumentUrlSignerPort } from './queue.js';
import { IdentityService, type QueueEnqueuerPort } from './service.js';
import { IdentityController } from './controller.js';
import { registerIdentityRoutes } from './routes.js';

const DOCUMENT_URL_TTL_SECONDS = 300;

// Not wrapped in fastify-plugin — needs its own encapsulated context for
// `{ prefix: '/identity' }` to apply, same reasoning as the other route-registering modules.
export default async function identityModule(app: FastifyInstance): Promise<void> {
  const repository = new KycVerificationRepository(app.mongo.db);
  await repository.createIndexes();

  // BullMQ requires maxRetriesPerRequest disabled on its Redis connections — app.redis is
  // configured for the app's own cache/session use, so this module brings its own connections
  // rather than repurposing that one.
  const queueConnection = new Redis(app.config.redis.url, { maxRetriesPerRequest: null });
  const workerConnection = new Redis(app.config.redis.url, { maxRetriesPerRequest: null });

  const queue = createKycQueue(queueConnection, {
    attempts: app.config.kycJob.attempts,
    backoffMs: app.config.kycJob.backoffMs,
  });

  const documentSigner: DocumentUrlSignerPort = {
    async createPresignedGetUrl(key: string) {
      const command = new GetObjectCommand({ Bucket: app.config.s3.bucket, Key: key });
      return getSignedUrl(app.s3, command, { expiresIn: DOCUMENT_URL_TTL_SECONDS });
    },
  };
  const premblyClient = new HttpPremblyClient(app.config.prembly.apiUrl, app.config.prembly.apiKey);

  const worker = createKycWorker(workerConnection, { repository, documentSigner, premblyClient });
  worker.on('failed', (job, error) => {
    if (!job) return;
    const attempts = job.opts.attempts ?? 1;
    // Only land the record in 'failed' once every retry is exhausted — earlier attempts just
    // retry per the queue's backoff, per the third-party-provider skill.
    if (job.attemptsMade >= attempts) {
      void repository.markFailed(job.data.verificationId, error.message);
    }
  });

  const queueEnqueuer: QueueEnqueuerPort = {
    async enqueueVerification(verificationId: string) {
      await queue.add('submit', { verificationId });
    },
  };
  const signatureVerifier = new HmacWebhookSignatureVerifier(app.config.prembly.webhookSecret);

  const service = new IdentityService(repository, queueEnqueuer, signatureVerifier, app.audit);
  const controller = new IdentityController(service);
  await registerIdentityRoutes(app, controller);

  app.addHook('onClose', async () => {
    await worker.close();
    await queue.close();
    await queueConnection.quit();
    await workerConnection.quit();
  });
}
