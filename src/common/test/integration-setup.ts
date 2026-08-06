import { loadEnv } from '../../config/env.js';

// Integration tests hit real Mongo/Redis (docker compose up -d). Load .env the same way `pnpm
// dev` does so `pnpm test:integration` works without a separate env-wiring step, then fail fast
// with a clear message instead of a cryptic connection timeout if that's not running.
try {
  process.loadEnvFile();
} catch {
  // No .env file — fall through and let loadEnv() report exactly which vars are missing.
}
loadEnv();
