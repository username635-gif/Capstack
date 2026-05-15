function readOptionalString(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();

  if (!raw) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  throw new Error(`[env] ${name} must be either "true" or "false"`);
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();

  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`[env] ${name} must be a valid number`);
  }

  return parsed;
}

function requireString(name: string, context: string): string {
  const value = readOptionalString(name);

  if (!value) {
    throw new Error(`[env] ${context} requires ${name}`);
  }

  return value;
}

function readCsv(name: string): string[] {
  const raw = readOptionalString(name);
  if (!raw) return [];
  return raw.split(',').map((part) => part.trim()).filter(Boolean);
}

export const apiEnv = {
  databaseUrl: readOptionalString('DATABASE_URL'),
  upstashRedisRestUrl: readOptionalString('UPSTASH_REDIS_REST_URL'),
  upstashRedisRestToken: readOptionalString('UPSTASH_REDIS_REST_TOKEN'),
  corsExtraOrigins: readCsv('CORS_EXTRA_ORIGINS'),
  rateLimitWindowMs: readNumber('RATE_LIMIT_WINDOW_MS', 60_000),
  payfastTestingMode: readBoolean('PAYFAST_TESTING_MODE', true),
};

export function getR2Env() {
  return {
    endpoint: requireString('R2_ENDPOINT', 'Document uploads'),
    accessKeyId: requireString('R2_ACCESS_KEY', 'Document uploads'),
    secretAccessKey: requireString('R2_SECRET_KEY', 'Document uploads'),
    bucket: readOptionalString('R2_BUCKET') ?? 'capstack-documents',
  };
}

export function getPayfastEnv() {
  const merchantId = readOptionalString('PAYFAST_MERCHANT_ID') ?? '';
  const merchantKey = readOptionalString('PAYFAST_MERCHANT_KEY') ?? '';
  const passphrase = readOptionalString('PAYFAST_PASSPHRASE') ?? '';
  const testing = readBoolean('PAYFAST_TESTING_MODE', true);

  if (!testing && (!merchantId || !merchantKey)) {
    throw new Error(
      '[env] Live PayFast mode requires PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY',
    );
  }

  return { merchantId, merchantKey, passphrase, testing };
}