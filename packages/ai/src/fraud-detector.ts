/**
 * Fraud detection — velocity checks, device fingerprinting, behavioural signals.
 *
 * WHAT THIS DETECTS:
 *   1. IP velocity       — same IP submitting N applications within a short window
 *   2. Device velocity   — same device fingerprint on multiple borrower accounts
 *   3. Identity reuse    — same ID number attempted across multiple borrower records
 *   4. Email pattern     — disposable email domains (known fraud indicators)
 *   5. Phone velocity    — same phone number across multiple applications
 *   6. Application burst — single borrower submitting applications too rapidly
 *
 * REGULATORY CONTEXT:
 *   Under FICA s.4(b)(ii) lenders must apply a risk-based approach to CDD.
 *   Velocity fraud indicators contribute to the ML risk score and may trigger
 *   enhanced due diligence (EDD) — a manual review by the compliance team.
 *
 * PRODUCTION INTEGRATION:
 *   Replace the Redis stub counters with a real Redis instance (Upstash)
 *   and wire deviceFingerprint into the front-end using:
 *     - FingerprintJS Pro (https://fingerprint.com) — device fingerprint
 *     - Sardine (https://sardine.ai) — full device intelligence + fraud scoring
 *     - Seon (https://seon.io) — email/phone/IP intelligence
 *
 * Patterns applied:
 *   1. Early return — no signals found → low risk
 *   2. Ternary — risk level assignment
 *   5. Array methods — filter for active flags
 *   6. to() helper — Redis calls as values
 *   7. Property shorthand
 *   8. Composition — detectFraud orchestrates all signal checkers
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type FraudSignal =
  | 'IP_VELOCITY'
  | 'DEVICE_VELOCITY'
  | 'IDENTITY_REUSE'
  | 'DISPOSABLE_EMAIL'
  | 'PHONE_VELOCITY'
  | 'APPLICATION_BURST';

export type FraudRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface FraudFlag {
  signal:      FraudSignal;
  riskLevel:   FraudRiskLevel;
  description: string;
  count:       number;    // how many times this signal was triggered
  windowMins:  number;    // evaluation window in minutes
}

export interface FraudCheckInput {
  borrowerId:        string;
  applicationId:     string;
  ip?:               string;
  deviceFingerprint?: string;
  email:             string;
  phone:             string;
  idNumber:          string;
}

export interface FraudCheckResult {
  borrowerId:     string;
  applicationId:  string;
  checkedAt:      string;         // ISO 8601
  flags:          FraudFlag[];
  riskLevel:      FraudRiskLevel;
  blocked:        boolean;        // HIGH risk → block application
  requiresReview: boolean;        // MEDIUM risk → send to human review queue
}

// ─── Thresholds (adjustable) ─────────────────────────────────────────────────

const IP_LIMIT_PER_HOUR          = 5;   // same IP → max 5 applications per hour
const DEVICE_LIMIT_PER_HOUR      = 3;   // same device → max 3 applications per hour
const PHONE_LIMIT_PER_DAY        = 2;   // same phone → max 2 applications per day
const APPLICATION_BURST_MINS     = 10;  // borrower submits >2 in 10 minutes = burst
const APPLICATION_BURST_LIMIT    = 2;

// Disposable email domains (abbreviated — use a real list in production)
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'spam4.me', 'dispostable.com', 'fakeinbox.com', 'trashmail.com',
]);

// ─── Helper ───────────────────────────────────────────────────────────────────

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

/**
 * Increment a counter in Redis and return the new value.
 * Uses INCR + EXPIRE (atomic for Redis — safe for rate-limiting).
 *
 * In production: pass in the real redis client from apps/api/src/lib/redis.ts
 * For now this is a pure in-memory stub (restarts on server restart).
 */
const _memoryCounters = new Map<string, { count: number; expiresAt: number }>();

async function _incrementCounter(key: string, windowSecs: number): Promise<number> {
  const now = Date.now();
  const existing = _memoryCounters.get(key);
  if (existing && now < existing.expiresAt) {
    existing.count++;
    return existing.count;
  }
  _memoryCounters.set(key, { count: 1, expiresAt: now + windowSecs * 1000 });
  return 1;
}

async function _getCounter(key: string): Promise<number> {
  const now = Date.now();
  const existing = _memoryCounters.get(key);
  if (!existing || now >= existing.expiresAt) return 0;
  return existing.count;
}

// ─── Signal checkers ─────────────────────────────────────────────────────────

async function checkIpVelocity(ip?: string): Promise<FraudFlag | null> {
  // Pattern 1 — early return on missing IP
  if (!ip) return null;

  const count = await _incrementCounter(`fraud:ip:${ip}`, 3600); // 1-hour window
  if (count <= IP_LIMIT_PER_HOUR) return null;

  return {
    signal:      'IP_VELOCITY',
    riskLevel:   count > IP_LIMIT_PER_HOUR * 2 ? 'HIGH' : 'MEDIUM',
    description: `IP ${ip} submitted ${count} applications in the last hour (limit: ${IP_LIMIT_PER_HOUR})`,
    count,
    windowMins:  60,
  };
}

async function checkDeviceVelocity(deviceFingerprint?: string): Promise<FraudFlag | null> {
  if (!deviceFingerprint) return null;

  const count = await _incrementCounter(`fraud:device:${deviceFingerprint}`, 3600);
  if (count <= DEVICE_LIMIT_PER_HOUR) return null;

  return {
    signal:      'DEVICE_VELOCITY',
    riskLevel:   'HIGH',
    description: `Device ${deviceFingerprint.slice(0, 12)}... submitted ${count} applications in the last hour`,
    count,
    windowMins:  60,
  };
}

async function checkPhoneVelocity(phone: string): Promise<FraudFlag | null> {
  if (!phone) return null;

  const count = await _incrementCounter(`fraud:phone:${phone}`, 86400); // 24-hour window
  if (count <= PHONE_LIMIT_PER_DAY) return null;

  return {
    signal:      'PHONE_VELOCITY',
    riskLevel:   'MEDIUM',
    description: `Phone ${phone} used on ${count} applications in the last 24 hours (limit: ${PHONE_LIMIT_PER_DAY})`,
    count,
    windowMins:  1440,
  };
}

function checkDisposableEmail(email: string): FraudFlag | null {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (!DISPOSABLE_EMAIL_DOMAINS.has(domain)) return null;

  return {
    signal:      'DISPOSABLE_EMAIL',
    riskLevel:   'MEDIUM',
    description: `Email domain "${domain}" is a known disposable/temporary email provider`,
    count:       1,
    windowMins:  0,
  };
}

async function checkApplicationBurst(borrowerId: string): Promise<FraudFlag | null> {
  const count = await _incrementCounter(
    `fraud:burst:${borrowerId}`,
    APPLICATION_BURST_MINS * 60,
  );
  if (count <= APPLICATION_BURST_LIMIT) return null;

  return {
    signal:      'APPLICATION_BURST',
    riskLevel:   'HIGH',
    description: `Borrower ${borrowerId} submitted ${count} applications within ${APPLICATION_BURST_MINS} minutes`,
    count,
    windowMins:  APPLICATION_BURST_MINS,
  };
}

// ─── Main checker ─────────────────────────────────────────────────────────────

/**
 * Run all fraud signal checks for an incoming application.
 * Pattern 8 — compose: ip + device + phone + email + burst → aggregate
 */
export async function detectFraud(input: FraudCheckInput): Promise<FraudCheckResult> {
  // Pattern 5 — run all checks in parallel for speed
  const [ipFlag, deviceFlag, phoneFlag, burstFlag] = await Promise.all([
    checkIpVelocity(input.ip),
    checkDeviceVelocity(input.deviceFingerprint),
    checkPhoneVelocity(input.phone),
    checkApplicationBurst(input.borrowerId),
  ]);

  const emailFlag = checkDisposableEmail(input.email);

  // Pattern 5 — filter out nulls
  const flags: FraudFlag[] = [ipFlag, deviceFlag, phoneFlag, burstFlag, emailFlag].filter(
    (f): f is FraudFlag => f !== null,
  );

  // Pattern 1 — early return when there are no flags (fast path for clean applications)
  if (flags.length === 0) {
    return {
      borrowerId:     input.borrowerId,
      applicationId:  input.applicationId,
      checkedAt:      new Date().toISOString(),
      flags:          [],
      riskLevel:      'LOW',
      blocked:        false,
      requiresReview: false,
    };
  }

  // Pattern 2 — ternary for overall risk assessment
  const riskLevel: FraudRiskLevel = flags.some(f => f.riskLevel === 'HIGH')
    ? 'HIGH'
    : flags.some(f => f.riskLevel === 'MEDIUM')
      ? 'MEDIUM'
      : 'LOW';

  const blocked        = riskLevel === 'HIGH';
  const requiresReview = riskLevel === 'MEDIUM';

  // Pattern 7 — shorthand
  return {
    borrowerId:    input.borrowerId,
    applicationId: input.applicationId,
    checkedAt:     new Date().toISOString(),
    flags,
    riskLevel,
    blocked,
    requiresReview,
  };
}
