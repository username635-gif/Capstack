import { collectionsAgent } from '@capstack/ai';

type CollectionEventInput = {
  type: string;
  channel: string | null;
  outcome: string | null;
  payload: unknown;
  createdAt: Date;
};

type DecisionInput = {
  pdScore: number | null;
} | null;

export type CollectionsInsightInput = {
  loanId: string;
  daysPastDue: number;
  delinquencyState: string;
  outstandingPrincipalCents: number;
  outstandingInterestCents: number;
  outstandingFeesCents: number;
  latestDecision: DecisionInput;
  events: CollectionEventInput[];
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

function getNextBestChannel(action: string): 'SMS' | 'EMAIL' | 'CALL' | 'WHATSAPP' | 'LEGAL' {
  if (action === 'EMAIL_REMINDER') return 'EMAIL';
  if (action === 'CALL' || action === 'RESTRUCTURE_OFFER') return 'CALL';
  if (action === 'LEGAL') return 'LEGAL';
  return 'SMS';
}

function getCollectionsStage(daysPastDue: number): 'EARLY' | 'MID' | 'LATE' | 'LEGAL' {
  if (daysPastDue >= 60) return 'LEGAL';
  if (daysPastDue >= 30) return 'LATE';
  if (daysPastDue >= 8) return 'MID';
  return 'EARLY';
}

function getFollowUpDays(priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): number {
  if (priority === 'CRITICAL') return 1;
  if (priority === 'HIGH') return 2;
  if (priority === 'MEDIUM') return 4;
  return 7;
}

function getPredictedRecoveryPct(
  daysPastDue: number,
  defaultRiskPct: number | null,
  promiseStatus: 'NONE' | 'OPEN' | 'DUE' | 'BROKEN',
): number {
  let score = daysPastDue >= 90 ? 22 : daysPastDue >= 60 ? 36 : daysPastDue >= 30 ? 54 : daysPastDue >= 14 ? 71 : 86;

  if (defaultRiskPct !== null) {
    score -= Math.round(defaultRiskPct / 6);
  }

  if (promiseStatus === 'OPEN') score += 10;
  if (promiseStatus === 'BROKEN') score -= 15;
  if (promiseStatus === 'DUE') score -= 6;

  return Math.max(5, Math.min(95, score));
}

export function buildCollectionsInsight(input: CollectionsInsightInput) {
  const events = [...input.events].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  const outstandingTotalCents = input.outstandingPrincipalCents + input.outstandingInterestCents + input.outstandingFeesCents;
  const recommendedAction = collectionsAgent({
    loanId: input.loanId,
    borrowerId: input.loanId,
    daysPastDue: input.daysPastDue,
    outstanding: outstandingTotalCents,
  });

  const contactEvents = events.filter((event) => ['REMINDER_SENT', 'CALL_MADE', 'LEGAL_ESCALATED', 'PROMISE_TO_PAY', 'BROKEN_PTP', 'RESTRUCTURE_OFFERED'].includes(event.type));
  const noteEvents = events.filter((event) => event.type === 'NOTE_ADDED');
  const reminderEvents = events.filter((event) => event.type === 'REMINDER_SENT');
  const callEvents = events.filter((event) => event.type === 'CALL_MADE');
  const brokenPromiseEvents = events.filter((event) => event.type === 'BROKEN_PTP');
  const legalEvents = events.filter((event) => event.type === 'LEGAL_ESCALATED');
  const restructureEvents = events.filter((event) => event.type === 'RESTRUCTURE_OFFERED');

  const promiseEvent = events.find((event) => event.type === 'PROMISE_TO_PAY') ?? null;
  const promisePayload = asObject(promiseEvent?.payload) ?? {};
  const promiseDate = typeof promisePayload.promiseDate === 'string'
    ? new Date(promisePayload.promiseDate)
    : typeof promisePayload.dueDate === 'string'
      ? new Date(promisePayload.dueDate)
      : null;
  const promiseAmountCents = typeof promisePayload.promiseAmountCents === 'number'
    ? promisePayload.promiseAmountCents
    : typeof promisePayload.amountCents === 'number'
      ? promisePayload.amountCents
      : null;

  const now = new Date();
  const lastContact = contactEvents[0] ?? null;
  const daysSinceLastContact = lastContact ? daysBetween(now, lastContact.createdAt) : null;
  const promiseStatus: 'NONE' | 'OPEN' | 'DUE' | 'BROKEN' = !promiseEvent
    ? 'NONE'
    : brokenPromiseEvents.some((event) => event.createdAt >= promiseEvent.createdAt)
      ? 'BROKEN'
      : promiseDate && promiseDate.getTime() < now.getTime()
        ? 'DUE'
        : 'OPEN';

  const defaultRiskPct = input.latestDecision?.pdScore == null
    ? null
    : Math.max(0, Math.min(100, Math.round(input.latestDecision.pdScore * 100)));

  const nextActionDueAt = new Date(
    (lastContact?.createdAt ?? now).getTime() + getFollowUpDays(recommendedAction.priority) * 86_400_000,
  );

  const requiresImmediateAction =
    input.daysPastDue >= 30
    || lastContact === null
    || (daysSinceLastContact ?? 999) >= getFollowUpDays(recommendedAction.priority);

  return {
    stage: getCollectionsStage(input.daysPastDue),
    outstandingTotalCents,
    latestCollectionEvent: lastContact
      ? {
          type: lastContact.type,
          channel: lastContact.channel,
          notes: asObject(lastContact.payload)?.notes ?? lastContact.outcome ?? null,
          createdAt: lastContact.createdAt.toISOString(),
        }
      : null,
    ai: {
      recommendedAction: recommendedAction.action,
      priority: recommendedAction.priority,
      message: recommendedAction.message,
      nextBestChannel: getNextBestChannel(recommendedAction.action),
      defaultRiskPct,
      predictedRecoveryPct: getPredictedRecoveryPct(input.daysPastDue, defaultRiskPct, promiseStatus),
    },
    workflow: {
      requiresImmediateAction,
      lastContactAt: toIso(lastContact?.createdAt ?? null),
      lastContactType: lastContact?.type ?? null,
      lastContactChannel: lastContact?.channel ?? null,
      daysSinceLastContact,
      contactAttempts: reminderEvents.length + callEvents.length,
      noteCount: noteEvents.length,
      brokenPromiseCount: brokenPromiseEvents.length,
      legalEscalations: legalEvents.length,
      restructureOffers: restructureEvents.length,
      nextActionDueAt: nextActionDueAt.toISOString(),
      promiseToPay: promiseEvent
        ? {
            status: promiseStatus,
            amountCents: promiseAmountCents,
            dueDate: promiseDate?.toISOString() ?? null,
            loggedAt: promiseEvent.createdAt.toISOString(),
          }
        : null,
    },
  };
}

export function buildCollectionsSummary(
  items: Array<ReturnType<typeof buildCollectionsInsight>>,
) {
  const priorityCounts = items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.ai.priority] = (accumulator[item.ai.priority] ?? 0) + 1;
    return accumulator;
  }, {});

  const stageCounts = items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.stage] = (accumulator[item.stage] ?? 0) + 1;
    return accumulator;
  }, {});

  const daysSinceContact = items
    .map((item) => item.workflow.daysSinceLastContact)
    .filter((value): value is number => value !== null);

  return {
    totalLoans: items.length,
    totalOutstandingCents: items.reduce((sum, item) => sum + item.outstandingTotalCents, 0),
    immediateActionCount: items.filter((item) => item.workflow.requiresImmediateAction).length,
    promiseToPayOpenCount: items.filter((item) => item.workflow.promiseToPay?.status === 'OPEN').length,
    brokenPromiseCount: items.filter((item) => item.workflow.promiseToPay?.status === 'BROKEN').length,
    legalQueueCount: items.filter((item) => item.stage === 'LEGAL').length,
    restructureQueueCount: items.filter((item) => item.ai.recommendedAction === 'RESTRUCTURE_OFFER').length,
    avgDaysSinceLastContact: daysSinceContact.length
      ? Math.round(daysSinceContact.reduce((sum, value) => sum + value, 0) / daysSinceContact.length)
      : null,
    priorityCounts,
    stageCounts,
  };
}