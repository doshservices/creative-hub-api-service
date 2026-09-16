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
  // Only needed for an S3-compatible provider that isn't real AWS S3 (Railway buckets,
  // Cloudflare R2, MinIO, etc.) — leave unset for real AWS S3, where the SDK derives the
  // endpoint from AWS_REGION itself. Most such providers also need path-style addressing
  // (bucket in the URL path, not the hostname) rather than AWS's default virtual-hosted style.
  AWS_S3_ENDPOINT: z.url().optional(),
  AWS_S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),

  CORS_ORIGIN: z.string().min(1),

  PREMBLY_API_URL: z.string().min(1),
  PREMBLY_API_KEY: z.string().min(1),
  PREMBLY_APP_ID: z.string().min(1),
  // Small defaults suit local dev/test (fast failure); raise both in production so a slow
  // Prembly outage gets retried meaningfully before a verification is marked failed.
  KYC_JOB_ATTEMPTS: z.coerce.number().int().positive().default(3),
  KYC_JOB_BACKOFF_MS: z.coerce.number().int().positive().default(200),

  FLUTTERWAVE_API_URL: z.string().min(1).default('https://api.flutterwave.com/v3'),
  FLUTTERWAVE_SECRET_KEY: z.string().min(1),
  // The exact static secret Flutterwave echoes back in a webhook's `verif-hash` header — see
  // payments/webhook-auth.ts. Not an HMAC key.
  FLUTTERWAVE_WEBHOOK_SECRET_HASH: z.string().min(1),
  PAYMENTS_JOB_ATTEMPTS: z.coerce.number().int().positive().default(3),
  PAYMENTS_JOB_BACKOFF_MS: z.coerce.number().int().positive().default(200),
}).superRefine((data, ctx) => {
  // AWS_REGION=auto with no endpoint is always broken: the AWS SDK builds
  // `<bucket>.s3.auto.amazonaws.com`, which doesn't exist — 'auto' is the region value R2 (and
  // some other S3-compatible providers) expect, but only once AWS_S3_ENDPOINT points somewhere
  // real. Every presigned URL issued under this combination fails DNS resolution client-side,
  // silently — see the "Failed to load resource: net::ERR_NAME_NOT_RESOLVED" bug this guards
  // against. Fail at startup instead of issuing broken URLs.
  if (data.AWS_REGION === 'auto' && !data.AWS_S3_ENDPOINT) {
    ctx.addIssue({
      code: 'custom',
      path: ['AWS_S3_ENDPOINT'],
      message:
        "AWS_REGION is 'auto', which is only valid for an S3-compatible provider (Railway buckets, Cloudflare R2, MinIO) — AWS_S3_ENDPOINT must also be set to that provider's actual endpoint, or AWS_REGION must be a real AWS region.",
    });
  }
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
    endpoint: string | undefined;
    forcePathStyle: boolean;
  };
  cors: { origin: string };
  prembly: {
    apiUrl: string;
    apiKey: string;
    appId: string;
  };
  kycJob: {
    attempts: number;
    backoffMs: number;
  };
  flutterwave: {
    apiUrl: string;
    secretKey: string;
    webhookSecretHash: string;
  };
  paymentsJob: {
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
      endpoint: data.AWS_S3_ENDPOINT,
      forcePathStyle: data.AWS_S3_FORCE_PATH_STYLE,
    },
    cors: { origin: data.CORS_ORIGIN },
    prembly: {
      apiUrl: data.PREMBLY_API_URL,
      apiKey: data.PREMBLY_API_KEY,
      appId: data.PREMBLY_APP_ID,
    },
    kycJob: {
      attempts: data.KYC_JOB_ATTEMPTS,
      backoffMs: data.KYC_JOB_BACKOFF_MS,
    },
    flutterwave: {
      apiUrl: data.FLUTTERWAVE_API_URL,
      secretKey: data.FLUTTERWAVE_SECRET_KEY,
      webhookSecretHash: data.FLUTTERWAVE_WEBHOOK_SECRET_HASH,
    },
    paymentsJob: {
      attempts: data.PAYMENTS_JOB_ATTEMPTS,
      backoffMs: data.PAYMENTS_JOB_BACKOFF_MS,
    },
  };
  return cached;
}
