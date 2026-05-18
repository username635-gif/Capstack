'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import OpsLayout from '@/app/_components/OpsLayout';
import { API_BASE_URL, buildOpsApiHeaders } from '@/lib/api-client';

type CollectionAction =
  | 'SMS_REMINDER'
  | 'EMAIL_REMINDER'
  | 'WHATSAPP_REMINDER'
  | 'CALL'
  | 'PROMISE_TO_PAY'
  | 'BROKEN_PTP'
  | 'RESTRUCTURE_OFFER'
  | 'LEGAL'
  | 'NOTE_ADDED';

type CollectionLoan = {
  id: string;
  loanNumber: string;
  status: string;
  daysPastDue: number;
  delinquencyState: string;
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingFees: number;
  outstandingTotalCents: number;
  borrower: {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    riskRating: string | null;
    blacklistFlag: boolean;
  };
  latestCollectionEvent: {
    type: string;
    channel: string | null;
    notes: string | null;
    createdAt: string;
  } | null;
  ai: {
    recommendedAction: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
    nextBestChannel: string;
    defaultRiskPct: number | null;
    predictedRecoveryPct: number;
  };
  workflow: {
    requiresImmediateAction: boolean;
    lastContactAt: string | null;
    lastContactType: string | null;
    lastContactChannel: string | null;
    daysSinceLastContact: number | null;
    contactAttempts: number;
    noteCount: number;
    brokenPromiseCount: number;
    legalEscalations: number;
    restructureOffers: number;
    nextActionDueAt: string;
    promiseToPay: {
      status: 'OPEN' | 'DUE' | 'BROKEN';
      amountCents: number | null;
      dueDate: string | null;
      loggedAt: string;
    } | null;
  };
  events: Array<{
    id: string;
    type: string;
    channel: string | null;
    outcome: string | null;
    createdAt: string;
  }>;
};

type CollectionsSummary = {
  totalLoans: number;
  totalOutstandingCents: number;
  immediateActionCount: number;
  promiseToPayOpenCount: number;
  brokenPromiseCount: number;
  legalQueueCount: number;
  restructureQueueCount: number;
  avgDaysSinceLastContact: number | null;
  priorityCounts: Record<string, number>;
  stageCounts: Record<string, number>;
};

type CollectionDraft = {
  action: CollectionAction;
  channel: string;
  notes: string;
  message: string;
  promiseDate: string;
  promiseAmount: string;
};

type ArrearsBucket = 'ALL' | '1_30' | '31_60' | '61_90' | '90_PLUS';

const ACTION_OPTIONS: Array<{ value: CollectionAction; label: string }> = [
  { value: 'SMS_REMINDER', label: 'SMS Reminder' },
  { value: 'EMAIL_REMINDER', label: 'Email Reminder' },
  { value: 'WHATSAPP_REMINDER', label: 'WhatsApp Reminder' },
  { value: 'CALL', label: 'Call Logged' },
  { value: 'PROMISE_TO_PAY', label: 'Promise to Pay' },
  { value: 'BROKEN_PTP', label: 'Broken Promise' },
  { value: 'RESTRUCTURE_OFFER', label: 'Restructure Offer' },
  { value: 'LEGAL', label: 'Legal Escalation' },
  { value: 'NOTE_ADDED', label: 'Internal Note' },
];

function formatMoney(cents: number | null | undefined): string {
  if (cents == null) return 'R0';
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not logged';
  return new Date(value).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function priorityStyles(priority: CollectionLoan['ai']['priority']) {
  if (priority === 'CRITICAL') return { fg: '#991b1b', bg: '#fee2e2' };
  if (priority === 'HIGH') return { fg: '#9a3412', bg: '#ffedd5' };
  if (priority === 'MEDIUM') return { fg: '#92400e', bg: '#fef3c7' };
  return { fg: '#155e75', bg: '#cffafe' };
}

function deadlineStyles(required: boolean) {
  return required
    ? { fg: '#991b1b', bg: '#fee2e2' }
    : { fg: '#166534', bg: '#dcfce7' };
}

function defaultChannel(action: CollectionAction): string {
  if (action === 'EMAIL_REMINDER') return 'EMAIL';
  if (action === 'WHATSAPP_REMINDER') return 'WHATSAPP';
  if (action === 'CALL' || action === 'RESTRUCTURE_OFFER') return 'CALL';
  if (action === 'LEGAL') return 'LEGAL';
  if (action === 'NOTE_ADDED') return 'INTERNAL';
  return 'SMS';
}

function defaultAction(loan: CollectionLoan): CollectionAction {
  const recommendation = loan.ai.recommendedAction;
  if (recommendation === 'LEGAL' || recommendation === 'CALL' || recommendation === 'RESTRUCTURE_OFFER') {
    return recommendation;
  }
  if (recommendation === 'EMAIL_REMINDER' || recommendation === 'SMS_REMINDER') {
    return recommendation;
  }
  return loan.workflow.promiseToPay ? 'PROMISE_TO_PAY' : 'NOTE_ADDED';
}

function getBucket(loan: CollectionLoan): Exclude<ArrearsBucket, 'ALL'> {
  if (loan.daysPastDue >= 90) return '90_PLUS';
  if (loan.daysPastDue >= 61) return '61_90';
  if (loan.daysPastDue >= 31) return '31_60';
  return '1_30';
}

function matchesBucket(loan: CollectionLoan, bucket: ArrearsBucket) {
  if (bucket === 'ALL') return true;
  return getBucket(loan) === bucket;
}

function bucketLabel(bucket: ArrearsBucket) {
  switch (bucket) {
    case '1_30': return '1-30 DPD';
    case '31_60': return '31-60 DPD';
    case '61_90': return '61-90 DPD';
    case '90_PLUS': return '90+ DPD';
    default: return 'All arrears';
  }
}

function resolveDraft(loan: CollectionLoan, current?: CollectionDraft): CollectionDraft {
  const action = current?.action ?? defaultAction(loan);
  return {
    action,
    channel: current?.channel ?? defaultChannel(action),
    notes: current?.notes ?? '',
    message: current?.message ?? '',
    promiseDate: current?.promiseDate ?? '',
    promiseAmount: current?.promiseAmount ?? '',
  };
}

export default function CollectionsPage() {
  const [bucket, setBucket] = useState<ArrearsBucket>('ALL');
  const [queue, setQueue] = useState<CollectionLoan[]>([]);
  const [summary, setSummary] = useState<CollectionsSummary | null>(null);
  const [drafts, setDrafts] = useState<Record<string, CollectionDraft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingLoanId, setSubmittingLoanId] = useState<string | null>(null);

  const loadQueue = useEffectEvent(async () => {
    setLoading(true);
    setError(null);

    try {
      const headers = await buildOpsApiHeaders();
      const response = await fetch(`${API_BASE_URL}/api/v1/collections?minDpd=1`, {
        headers,
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to load collections queue');
      }

      const payload = await response.json() as {
        data: CollectionLoan[];
        summary: CollectionsSummary;
      };

      setQueue(payload.data);
      setSummary(payload.summary);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load collections queue');
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  function patchDraft(loan: CollectionLoan, patch: Partial<CollectionDraft>) {
    setDrafts((current) => ({
      ...current,
      [loan.id]: {
        ...resolveDraft(loan, current[loan.id]),
        ...patch,
      },
    }));
  }

  async function submitAction(loan: CollectionLoan) {
    const draft = resolveDraft(loan, drafts[loan.id]);
    setSubmittingLoanId(loan.id);
    setError(null);

    try {
      const headers = await buildOpsApiHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch(`${API_BASE_URL}/api/v1/collections`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          loanId: loan.id,
          action: draft.action,
          channel: draft.channel,
          notes: draft.notes,
          message: draft.message || undefined,
          promiseDate: draft.promiseDate || undefined,
          promiseAmountCents: draft.promiseAmount ? Math.round(Number(draft.promiseAmount) * 100) : undefined,
          sendBorrowerNotification: !['NOTE_ADDED', 'CALL'].includes(draft.action),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: 'Failed to log collections action' })) as { error?: string };
        throw new Error(payload.error ?? 'Failed to log collections action');
      }

      setDrafts((current) => {
        const next = { ...current };
        delete next[loan.id];
        return next;
      });
      await loadQueue();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to log collections action');
    } finally {
      setSubmittingLoanId(null);
    }
  }

  const bucketCounts: Record<ArrearsBucket, number> = {
    ALL: queue.length,
    '1_30': queue.filter((loan) => matchesBucket(loan, '1_30')).length,
    '31_60': queue.filter((loan) => matchesBucket(loan, '31_60')).length,
    '61_90': queue.filter((loan) => matchesBucket(loan, '61_90')).length,
    '90_PLUS': queue.filter((loan) => matchesBucket(loan, '90_PLUS')).length,
  };
  const filteredQueue = queue.filter((loan) => matchesBucket(loan, bucket));

  return (
    <OpsLayout title="Collections">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">Arrears bucket</span>
          {(['ALL', '1_30', '31_60', '61_90', '90_PLUS'] as ArrearsBucket[]).map((value) => (
            <button
              key={value}
              onClick={() => setBucket(value)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-2"
              style={{
                background: bucket === value ? 'var(--color-primary)' : 'var(--color-surface-2)',
                color: bucket === value ? '#fff' : 'var(--color-muted)',
              }}
            >
              <span>{bucketLabel(value)}</span>
              <span
                className="min-w-5 px-1.5 py-0.5 rounded-full"
                style={{ background: bucket === value ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.06)' }}
              >
                {bucketCounts[value]}
              </span>
            </button>
          ))}
          <span className="text-sm ml-auto" style={{ color: 'var(--color-muted)' }}>
            {filteredQueue.length} loan{filteredQueue.length === 1 ? '' : 's'} in {bucketLabel(bucket).toLowerCase()}
          </span>
        </div>

        {(bucket === '61_90' || bucket === '90_PLUS') && (
          <div className="rounded-2xl p-4" style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412' }}>
            <div className="font-semibold">60+ day escalation workflow</div>
            <div className="text-sm mt-1">
              These accounts should move through structured escalation: confirm recent contact attempt, log or break promise-to-pay, consider restructure offer, then escalate to legal if no cure path exists.
            </div>
          </div>
        )}

        {summary && (
          <div className="grid gap-4 md:grid-cols-5">
            {[
              { label: 'Queue Balance', value: formatMoney(summary.totalOutstandingCents) },
              { label: 'Immediate Action', value: String(summary.immediateActionCount) },
              { label: 'Open PTP', value: String(summary.promiseToPayOpenCount) },
              { label: 'Broken PTP', value: String(summary.brokenPromiseCount) },
              { label: 'Legal Queue', value: String(summary.legalQueueCount) },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl p-4"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <div className="text-xs uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--color-muted)' }}>{card.label}</div>
                <div className="text-xl font-bold">{card.value}</div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#fee2e2', color: '#991b1b' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading collections queue…</p>
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No delinquent loans matched the selected arrears bucket.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredQueue.map((loan) => {
              const priority = priorityStyles(loan.ai.priority);
              const deadline = deadlineStyles(loan.workflow.requiresImmediateAction);
              const draft = resolveDraft(loan, drafts[loan.id]);

              return (
                <div
                  key={loan.id}
                  className="rounded-2xl p-5 grid gap-5 xl:grid-cols-[1.2fr_1fr_1.15fr]"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs mb-1" style={{ color: 'var(--color-muted)' }}>{loan.loanNumber}</div>
                        <div className="text-lg font-bold">{loan.borrower.name}</div>
                        <div className="text-sm" style={{ color: 'var(--color-muted)' }}>{loan.borrower.email}</div>
                        {loan.borrower.phone && (
                          <div className="text-sm" style={{ color: 'var(--color-muted)' }}>{loan.borrower.phone}</div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: priority.bg, color: priority.fg }}>
                          {loan.ai.priority} priority
                        </span>
                        <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: deadline.bg, color: deadline.fg }}>
                          {loan.daysPastDue} DPD · {bucketLabel(getBucket(loan))}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-2)' }}>
                        <div className="text-xs uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--color-muted)' }}>Exposure</div>
                        <div className="font-semibold">{formatMoney(loan.outstandingTotalCents)}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                          Principal {formatMoney(loan.outstandingPrincipal)}
                        </div>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-2)' }}>
                        <div className="text-xs uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--color-muted)' }}>AI Recommendation</div>
                        <div className="font-semibold">{loan.ai.recommendedAction.replace(/_/g, ' ')}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                          Recovery {loan.ai.predictedRecoveryPct}%
                          {loan.ai.defaultRiskPct != null ? ` · Default risk ${loan.ai.defaultRiskPct}%` : ''}
                        </div>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-2)' }}>
                        <div className="text-xs uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--color-muted)' }}>Workflow</div>
                        <div className="font-semibold">{loan.workflow.requiresImmediateAction ? 'Needs action now' : 'On track'}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                          Next due {formatDate(loan.workflow.nextActionDueAt)}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-2)' }}>
                        <div className="text-xs uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--color-muted)' }}>Recent Activity</div>
                        <div className="text-sm font-medium">{loan.latestCollectionEvent ? loan.latestCollectionEvent.type.replace(/_/g, ' ') : 'No contact logged'}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                          Last touch {formatDate(loan.workflow.lastContactAt)}
                          {loan.workflow.daysSinceLastContact != null ? ` · ${loan.workflow.daysSinceLastContact} day(s) ago` : ''}
                        </div>
                        {loan.latestCollectionEvent?.notes && (
                          <div className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>{loan.latestCollectionEvent.notes}</div>
                        )}
                      </div>

                      <div className="rounded-xl p-3" style={{ background: 'var(--color-surface-2)' }}>
                        <div className="text-xs uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--color-muted)' }}>Collections Signals</div>
                        <div className="text-sm">Attempts {loan.workflow.contactAttempts} · Notes {loan.workflow.noteCount}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                          Broken PTP {loan.workflow.brokenPromiseCount} · Legal escalations {loan.workflow.legalEscalations}
                        </div>
                        {loan.workflow.promiseToPay && (
                          <div className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>
                            Promise to pay {loan.workflow.promiseToPay.status.toLowerCase()} · {loan.workflow.promiseToPay.amountCents != null ? formatMoney(loan.workflow.promiseToPay.amountCents) : 'Amount pending'} · due {formatDate(loan.workflow.promiseToPay.dueDate)}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {loan.events.slice(0, 4).map((event) => (
                        <span
                          key={event.id}
                          className="text-xs px-2.5 py-1.5 rounded-full"
                          style={{ background: 'var(--color-surface-2)', color: 'var(--color-muted)' }}
                        >
                          {event.type.replace(/_/g, ' ')} · {formatDate(event.createdAt)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--color-surface-2)' }}>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--color-muted)' }}>AI Rationale</div>
                      <p className="text-sm">{loan.ai.message}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--color-muted)' }}>Preferred Channel</div>
                        <div className="text-sm font-medium">{loan.ai.nextBestChannel}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--color-muted)' }}>Borrower Flags</div>
                        <div className="text-sm font-medium">
                          {loan.borrower.blacklistFlag ? 'Blacklist flagged' : loan.borrower.riskRating ?? 'No risk flag'}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                      Delinquency state: {loan.delinquencyState.replace(/_/g, ' ')}
                    </div>
                    {loan.daysPastDue >= 61 && (
                      <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(254, 226, 226, 0.55)', border: '1px solid rgba(248, 113, 113, 0.35)' }}>
                        <div className="font-semibold">Escalation lane</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                          {loan.daysPastDue >= 90
                            ? 'Legal action is now the default path unless a documented cure plan exists.'
                            : 'Escalate from contact cycle into restructure or legal review if borrower remains non-responsive.'}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="text-xs uppercase tracking-[0.18em]" style={{ color: 'var(--color-muted)' }}>Log Action</div>

                    <select
                      value={draft.action}
                      onChange={(event) => {
                        const action = event.target.value as CollectionAction;
                        patchDraft(loan, { action, channel: defaultChannel(action) });
                      }}
                      className="px-3 py-3 rounded-lg text-sm"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                    >
                      {ACTION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>

                    <select
                      value={draft.channel}
                      onChange={(event) => patchDraft(loan, { channel: event.target.value })}
                      className="px-3 py-3 rounded-lg text-sm"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                    >
                      {['SMS', 'EMAIL', 'WHATSAPP', 'CALL', 'LEGAL', 'INTERNAL'].map((channel) => (
                        <option key={channel} value={channel}>{channel}</option>
                      ))}
                    </select>

                    <textarea
                      value={draft.notes}
                      onChange={(event) => patchDraft(loan, { notes: event.target.value })}
                      rows={3}
                      placeholder="Internal notes or outcome summary"
                      className="px-3 py-3 rounded-lg text-sm resize-none"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                    />

                    <input
                      type="text"
                      value={draft.message}
                      onChange={(event) => patchDraft(loan, { message: event.target.value })}
                      placeholder="Optional borrower-facing message override"
                      className="px-3 py-3 rounded-lg text-sm"
                      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                    />

                    {draft.action === 'PROMISE_TO_PAY' && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          type="date"
                          value={draft.promiseDate}
                          onChange={(event) => patchDraft(loan, { promiseDate: event.target.value })}
                          className="px-3 py-3 rounded-lg text-sm"
                          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.promiseAmount}
                          onChange={(event) => patchDraft(loan, { promiseAmount: event.target.value })}
                          placeholder="Promise amount"
                          className="px-3 py-3 rounded-lg text-sm"
                          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
                        />
                      </div>
                    )}

                    <button
                      onClick={() => void submitAction(loan)}
                      disabled={submittingLoanId === loan.id}
                      className="px-4 py-3 rounded-lg text-sm font-semibold disabled:opacity-60"
                      style={{ background: 'var(--color-primary)', color: '#fff' }}
                    >
                      {submittingLoanId === loan.id ? 'Saving…' : 'Save collections action'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </OpsLayout>
  );
}