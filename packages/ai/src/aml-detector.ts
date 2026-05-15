/**
 * AML (Anti-Money Laundering) anomaly detection on transaction streams.
 *
 * WHAT THIS MODULE DETECTS:
 *   1. Structuring (smurfing) — multiple deposits just below the R24 999 FICA
 *      reporting threshold to avoid Cash Threshold Reports (CTRs).
 *   2. Rapid movement — funds received and immediately re-sent (layering).
 *   3. Geo-velocity — transactions at physically impossible locations within a
 *      short timeframe (e.g. Cape Town at 09:00, Lagos at 09:15).
 *   4. Round-trip patterns — money sent to self or related entities.
 *   5. Velocity spikes — transaction frequency or volume far above the
 *      borrower's historical baseline.
 *
 * REGULATORY CONTEXT (South Africa):
 *   FICA (Financial Intelligence Centre Act) requires Accountable Institutions to:
 *   - File Suspicious Activity Reports (SARs) within 3 days of detecting suspicious
 *     patterns (s.29 and s.31 FICA).
 *   - File Cash Threshold Reports (CTRs) for any cash transaction ≥ R24 999.
 *   - Retain all transaction monitoring records for 5 years.
 *
 *   A `HIGH` risk alert must trigger an automated SAR filing and freeze the
 *   account pending compliance review. This is the hard guardrail — it cannot
 *   be overridden by an ops agent.
 *
 * PRODUCTION INTEGRATION:
 *   Replace the heuristic rules with a real-time ML classifier:
 *     - Feature store: Kafka → Flink for sub-second feature computation
 *     - Model: Isolation Forest or Autoencoders for unsupervised anomaly detection
 *     - Or integrate NICE Actimize / Featurespace / SAS AML
 *
 * Patterns applied:
 *   1. Early return — short-circuit on empty transaction list
 *   2. Ternary — risk level assignment
 *   5. Array methods — filter / reduce for pattern detection
 *   7. Property shorthand
 *   8. Composition — analyseStream chains detectStructuring + detectRapidMovement + detectGeoVelocity
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Transaction {
  id:          string;
  date:        string;          // ISO 8601
  amount:      number;          // in cents (positive = incoming, negative = outgoing)
  description: string;
  type:        'credit' | 'debit';
  latitude?:   number;
  longitude?:  number;
  counterparty?: string;
}

export type AmlAlertType =
  | 'STRUCTURING'
  | 'RAPID_MOVEMENT'
  | 'GEO_VELOCITY'
  | 'ROUND_TRIP'
  | 'VELOCITY_SPIKE';

export type AmlRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AmlAlert {
  type:        AmlAlertType;
  riskLevel:   AmlRiskLevel;
  description: string;
  evidence:    string[];        // human-readable supporting facts
  sarRequired: boolean;         // HIGH risk → must file SAR with FIC within 3 days
}

export interface AmlAnalysisResult {
  borrowerId:     string;
  analysedAt:     string;       // ISO 8601
  alerts:         AmlAlert[];
  overallRisk:    AmlRiskLevel;
  sarRequired:    boolean;      // true if any alert requires SAR filing
  blockedFromDisbursement: boolean;  // hard guardrail — HIGH risk locks disbursement
}

// ─── Thresholds (configurable) ────────────────────────────────────────────────

const STRUCTURING_THRESHOLD_CENTS = 2_499_900;  // R24 999 — FICA CTR threshold
const STRUCTURING_WINDOW_DAYS     = 30;
const RAPID_MOVEMENT_HOURS        = 6;           // within-N-hour out = suspicious
const GEO_VELOCITY_KM_PER_MIN     = 10;          // ~600 km/h — faster than a car, flags air travel fraud
const VELOCITY_SPIKE_MULTIPLIER   = 5;           // 5× baseline = alert

// ─── Main analyser ────────────────────────────────────────────────────────────

/**
 * Analyse a borrower's transaction stream for AML red flags.
 * Pattern 8 — pipe: structuring → rapid movement → geo-velocity → aggregate
 */
export function analyseTransactionStream(
  borrowerId:   string,
  transactions: Transaction[],
): AmlAnalysisResult {
  // Pattern 1 — early return for empty stream
  if (!transactions.length) {
    return {
      borrowerId,
      analysedAt:              new Date().toISOString(),
      alerts:                  [],
      overallRisk:             'LOW',
      sarRequired:             false,
      blockedFromDisbursement: false,
    };
  }

  const alerts: AmlAlert[] = [
    ...detectStructuring(transactions),
    ...detectRapidMovement(transactions),
    ...detectGeoVelocity(transactions),
    ...detectRoundTrip(transactions),
    ...detectVelocitySpike(transactions),
  ];

  // Pattern 5 + 2 — reduce to highest risk level across all alerts
  const overallRisk: AmlRiskLevel = alerts.some(a => a.riskLevel === 'HIGH')
    ? 'HIGH'
    : alerts.some(a => a.riskLevel === 'MEDIUM')
      ? 'MEDIUM'
      : 'LOW';

  const sarRequired              = alerts.some(a => a.sarRequired);
  const blockedFromDisbursement  = overallRisk === 'HIGH'; // hard guardrail

  return {
    borrowerId,
    analysedAt:              new Date().toISOString(),
    alerts,
    overallRisk,
    sarRequired,
    blockedFromDisbursement,
  };
}

// ─── Detectors ────────────────────────────────────────────────────────────────

/**
 * Detect structuring: multiple deposits just below R24 999 within 30 days.
 * Pattern 5 — filter + reduce.
 */
function detectStructuring(txns: Transaction[]): AmlAlert[] {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - STRUCTURING_WINDOW_DAYS);

  // Credits (incoming) that are suspiciously close to but below the CTR threshold
  const suspicious = txns.filter(t =>
    t.type === 'credit' &&
    t.amount > 0 &&
    t.amount < STRUCTURING_THRESHOLD_CENTS &&
    t.amount > STRUCTURING_THRESHOLD_CENTS * 0.8 &&   // within 80–99% of threshold
    new Date(t.date) >= windowStart,
  );

  if (suspicious.length < 2) return [];

  return [{
    type:        'STRUCTURING',
    riskLevel:   suspicious.length >= 5 ? 'HIGH' : 'MEDIUM',
    description: `${suspicious.length} deposits between R${(STRUCTURING_THRESHOLD_CENTS * 0.8 / 100).toFixed(0)} and R${(STRUCTURING_THRESHOLD_CENTS / 100).toFixed(0)} within ${STRUCTURING_WINDOW_DAYS} days`,
    evidence:    suspicious.map(t => `${t.date}: R${(t.amount / 100).toFixed(2)} — ${t.description}`),
    sarRequired: suspicious.length >= 5,
  }];
}

/**
 * Detect rapid movement: large credit followed by debit within a short window.
 * Pattern 5 — sort + sliding window.
 */
function detectRapidMovement(txns: Transaction[]): AmlAlert[] {
  const sorted = [...txns].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const alerts: AmlAlert[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const credit = sorted[i];
    if (credit.type !== 'credit' || credit.amount <= 0) continue;

    // Look for a debit of similar size within RAPID_MOVEMENT_HOURS
    const windowEnd = new Date(credit.date).getTime() + RAPID_MOVEMENT_HOURS * 3_600_000;
    const rapidDebit = sorted.slice(i + 1).find(t =>
      t.type === 'debit' &&
      new Date(t.date).getTime() <= windowEnd &&
      Math.abs(t.amount) >= credit.amount * 0.8,
    );

    if (rapidDebit) {
      alerts.push({
        type:        'RAPID_MOVEMENT',
        riskLevel:   'HIGH',
        description: `R${(credit.amount / 100).toFixed(2)} received then R${(Math.abs(rapidDebit.amount) / 100).toFixed(2)} sent within ${RAPID_MOVEMENT_HOURS}h`,
        evidence:    [
          `Credit  ${credit.date}: ${credit.description} R${(credit.amount / 100).toFixed(2)}`,
          `Debit   ${rapidDebit.date}: ${rapidDebit.description} R${(Math.abs(rapidDebit.amount) / 100).toFixed(2)}`,
        ],
        sarRequired: true,
      });
    }
  }

  return alerts;
}

/**
 * Detect geo-velocity anomalies: transactions at impossible locations.
 * Pattern 5 — sorted pairs, haversine distance check.
 */
function detectGeoVelocity(txns: Transaction[]): AmlAlert[] {
  const geoTxns = txns.filter(t => t.latitude !== undefined && t.longitude !== undefined);
  if (geoTxns.length < 2) return [];

  const sorted  = [...geoTxns].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const alerts: AmlAlert[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const minutesDiff = (new Date(b.date).getTime() - new Date(a.date).getTime()) / 60_000;
    if (minutesDiff <= 0) continue;

    const km  = _haversineKm(a.latitude!, a.longitude!, b.latitude!, b.longitude!);
    const kmPerMin = km / minutesDiff;

    if (kmPerMin > GEO_VELOCITY_KM_PER_MIN) {
      alerts.push({
        type:        'GEO_VELOCITY',
        riskLevel:   'HIGH',
        description: `${km.toFixed(0)} km in ${minutesDiff.toFixed(0)} min (${(kmPerMin * 60).toFixed(0)} km/h) — physically impossible`,
        evidence:    [
          `${a.date}: (${a.latitude?.toFixed(3)}, ${a.longitude?.toFixed(3)}) — ${a.description}`,
          `${b.date}: (${b.latitude?.toFixed(3)}, ${b.longitude?.toFixed(3)}) — ${b.description}`,
        ],
        sarRequired: true,
      });
    }
  }

  return alerts;
}

/**
 * Detect round-trip: money sent to a counterparty who immediately sends it back.
 */
function detectRoundTrip(txns: Transaction[]): AmlAlert[] {
  const alerts: AmlAlert[] = [];
  const byCounterparty = new Map<string, Transaction[]>();

  for (const t of txns) {
    if (!t.counterparty) continue;
    const key = t.counterparty.toLowerCase().trim();
    if (!byCounterparty.has(key)) byCounterparty.set(key, []);
    byCounterparty.get(key)!.push(t);
  }

  for (const [counterparty, cpTxns] of byCounterparty) {
    const debits  = cpTxns.filter(t => t.type === 'debit');
    const credits = cpTxns.filter(t => t.type === 'credit');
    if (!debits.length || !credits.length) continue;

    const totalDebits  = debits.reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalCredits = credits.reduce((s, t) => s + t.amount, 0);
    const ratio        = Math.min(totalDebits, totalCredits) / Math.max(totalDebits, totalCredits);

    if (ratio > 0.85) {
      alerts.push({
        type:        'ROUND_TRIP',
        riskLevel:   'HIGH',
        description: `${ratio * 100 | 0}% of funds sent to "${counterparty}" returned — round-trip pattern`,
        evidence:    [
          `Total sent: R${(totalDebits / 100).toFixed(2)}`,
          `Total received back: R${(totalCredits / 100).toFixed(2)}`,
        ],
        sarRequired: true,
      });
    }
  }

  return alerts;
}

/**
 * Detect velocity spikes: sudden increase in transaction count or volume vs baseline.
 * Pattern 5 — compare rolling windows.
 */
function detectVelocitySpike(txns: Transaction[]): AmlAlert[] {
  if (txns.length < 20) return [];  // insufficient history for baseline

  const sorted = [...txns].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const now     = new Date();
  const day7    = new Date(); day7.setDate(now.getDate() - 7);
  const day30   = new Date(); day30.setDate(now.getDate() - 30);
  const day90   = new Date(); day90.setDate(now.getDate() - 90);

  const last7  = sorted.filter(t => new Date(t.date) >= day7).length;
  const days30to60 = sorted.filter(t => {
    const d = new Date(t.date);
    return d >= day90 && d < day30;
  }).length;

  const baseline = days30to60 / 4; // ~7-day baseline from 30–90 day window
  if (baseline === 0) return [];

  const spike = last7 / baseline;
  if (spike < VELOCITY_SPIKE_MULTIPLIER) return [];

  return [{
    type:        'VELOCITY_SPIKE',
    riskLevel:   spike >= 10 ? 'HIGH' : 'MEDIUM',
    description: `Transaction volume ${spike.toFixed(1)}× above baseline in last 7 days`,
    evidence:    [
      `Last 7 days: ${last7} transactions`,
      `7-day baseline (from 30-90 day window): ${baseline.toFixed(1)} transactions`,
    ],
    sarRequired: spike >= 10,
  }];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Haversine formula — straight-line distance in km between two lat/lng points. */
function _haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R      = 6_371;
  const toRad  = (d: number) => d * Math.PI / 180;
  const dLat   = toRad(lat2 - lat1);
  const dLon   = toRad(lon2 - lon1);
  const a      = Math.sin(dLat / 2) ** 2 +
                 Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
