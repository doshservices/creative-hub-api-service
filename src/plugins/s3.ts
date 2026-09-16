import fp from 'fastify-plugin';
import { S3Client } from '@aws-sdk/client-s3';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    s3: S3Client;
  }
}

export default fp(function s3Plugin(app: FastifyInstance) {
  const s3 = new S3Client({
    region: app.config.s3.region,
    credentials: {
      accessKeyId: app.config.s3.accessKeyId,
      secretAccessKey: app.config.s3.secretAccessKey,
    },
    // Only set for a non-AWS S3-compatible provider (Railway buckets, R2, MinIO) — undefined
    // here means the SDK falls back to its own AWS endpoint construction, unchanged from before.
    ...(app.config.s3.endpoint ? { endpoint: app.config.s3.endpoint } : {}),
    ...(app.config.s3.forcePathStyle ? { forcePathStyle: true } : {}),
  });

  app.decorate('s3', s3);
});
