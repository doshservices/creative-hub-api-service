import fp from 'fastify-plugin';
import { MongoClient, type Db } from 'mongodb';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    mongo: { client: MongoClient; db: Db };
  }
}

export default fp(async function mongoPlugin(app: FastifyInstance) {
  const client = new MongoClient(app.config.mongo.url, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db();

  app.decorate('mongo', { client, db });

  app.addHook('onClose', async () => {
    await client.close();
  });
});
