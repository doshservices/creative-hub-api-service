import closeWithGrace from 'close-with-grace';
import { buildApp } from './app.js';

const app = await buildApp();

closeWithGrace({ delay: 5000 }, async ({ err }) => {
  if (err) app.log.error(err);
  await app.close();
});

try {
  await app.listen({ port: app.config.port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
