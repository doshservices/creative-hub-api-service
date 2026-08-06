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
  });

  app.decorate('s3', s3);
});
