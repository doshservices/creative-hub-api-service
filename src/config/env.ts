import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  MONGO_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),

  AWS_REGION: z.string().min(1),
  AWS_S3_BUCKET: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),

  CORS_ORIGIN: z.string().min(1),

  PREMBLY_API_URL: z.string().min(1),
  PREMBLY_API_KEY: z.string().min(1),
  PREMBLY_WEBHOOK_SECRET: z.string().min(1),
  // Small defaults suit local dev/test (fast failure); raise both in production so a slow
  // Prembly outage gets retried meaningfully before a verification is marked failed.
  KYC_JOB_ATTEMPTS: z.coerce.number().int().positive().default(3),
  KYC_JOB_BACKOFF_MS: z.coerce.number().int().positive().default(200),
});

export type Env = z.infer<typeof envSchema>;

export interface AppConfig {
  env: Env['NODE_ENV'];
  isProduction: boolean;
  port: number;
  logLevel: Env['LOG_LEVEL'];
  mongo: { url: string };
  redis: { url: string };
  jwt: {
    accessSecret: string;
    accessTtl: string;
    refreshTtlSeconds: number;
  };
  s3: {
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  cors: { origin: string };
  prembly: {
    apiUrl: string;
    apiKey: string;
    webhookSecret: string;
  };
  kycJob: {
    attempts: number;
    backoffMs: number;
  };
}

let cached: AppConfig | undefined;

// The only function in the codebase allowed to read process.env — everything else imports
// `loadEnv()` (or receives the parsed config through Fastify's `app.config` decorator).
export function loadEnv(): AppConfig {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
  }

  const data = parsed.data;
  cached = {
    env: data.NODE_ENV,
    isProduction: data.NODE_ENV === 'production',
    port: data.PORT,
    logLevel: data.LOG_LEVEL,
    mongo: { url: data.MONGO_URL },
    redis: { url: data.REDIS_URL },
    jwt: {
      accessSecret: data.JWT_ACCESS_SECRET,
      accessTtl: data.JWT_ACCESS_TTL,
      refreshTtlSeconds: data.JWT_REFRESH_TTL_SECONDS,
    },
    s3: {
      region: data.AWS_REGION,
      bucket: data.AWS_S3_BUCKET,
      accessKeyId: data.AWS_ACCESS_KEY_ID,
      secretAccessKey: data.AWS_SECRET_ACCESS_KEY,
    },
    cors: { origin: data.CORS_ORIGIN },
    prembly: {
      apiUrl: data.PREMBLY_API_URL,
      apiKey: data.PREMBLY_API_KEY,
      webhookSecret: data.PREMBLY_WEBHOOK_SECRET,
    },
    kycJob: {
      attempts: data.KYC_JOB_ATTEMPTS,
      backoffMs: data.KYC_JOB_BACKOFF_MS,
    },
  };
  return cached;
}
