'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import OpsLayout from '@/app/_components/OpsLayout';
import { getSession } from '@/lib/session';
import { API_BASE_URL as API, buildOpsApiHeaders } from '@/lib/api-client';

type WorkflowStatus = 'ALL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PENDING_DISBURSEMENT';
type SortKey = 'amountRequested' | 'termDaysRequested' | 'submittedAt';
type SortDirection = 'asc' | 'desc';
type SlaStatus = 'WITHIN_SLA' | 'BREACH_SOON' | 'BREACHED';

type ApiApplication = {
  id: string;
  externalRef?: string | null;
  status: string;
  workflowStatus: Exclude<WorkflowStatus, 'ALL'>;
  amountRequested: number;
  termDaysRequested: number;
  submittedAt: string;
  borrower: {
    id: string;
    email: string;
    type: 'INDIVIDUAL' | 'BUSINESS';
    individual?: { fullName?: string | null } | null;
    business?: { legalName?: string | null } | null;
  };
  product?: {
    id: string;
    name: string;
    defaultAprBps?: number | null;
    amortizationMethod?: string | null;
  } | null;
  loan?: { status: string; loanNumber?: string | null } | null;
  canApprove: boolean;
  canReject: boolean;
  assignee?: { assignee: string; assignedAt: string; actor?: string | null } | null;
  flag?: { id: string; actor: string; createdAt: string; reason: string | null } | null;
  noteCount: number;
  ageHours: number;
  slaStatus: SlaStatus;
  approvalTier: 'AI_AUTO_ELIGIBLE' | 'ADVISOR_REVIEW' | 'MANAGER_SIGN_OFF';
  reviewPriority: 'LOW' | 'MEDIUM' | 'HIGH';
  underwriting: {
    recommendation?: string | null;
    riskBand?: string | null;
    riskScore?: number | null;
    confidencePct?: number | null;
    recommendedOffer: {
      amountCents: number;
      termDays: number;
      aprBps: number;
      estimatedInstallmentCents: number;
    };
  };
  compliance: {
    kycStatus: string;
    amlRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    bureauStatus: 'PULLED' | 'FAILED' | 'PENDING' | 'CONSENT_REQUIRED' | 'UNAVAILABLE';
    bureauScore?: number | null;
  };
  affordability: {
    canAfford: boolean | null;
    dtiPct: number | null;
    ncaStatus: 'PASS' | 'FAIL' | 'REVIEW';
  };
};

type ApplicationsResponse = {
  data: ApiApplication[];
  total: number;
  statusCounts: Record<WorkflowStatus, number>;
};

const ALL_STATUSES: WorkflowStatus[] = ['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PENDING_DISBURSEMENT'];
const PAGE_SIZE = 5;
const EMPTY_STATUS_COUNTS: Record<WorkflowStatus, number> = {
  ALL: 0,
  SUBMITTED: 0,
  APPROVED: 0,
  REJECTED: 0,
  PENDING_DISBURSEMENT: 0,
};

const STATUS_STYLES: Record<Exclude<WorkflowStatus, 'ALL'>, { bg: string; fg: string }> = {
  SUBMITTED: { bg: 'var(--badge-pending-bg)', fg: 'var(--badge-pending-fg)' },
  APPROVED: { bg: 'var(--badge-approved-bg)', fg: 'var(--badge-approved-fg)' },
  REJECTED: { bg: 'var(--badge-declined-bg)', fg: 'var(--badge-declined-fg)' },
  PENDING_DISBURSEMENT: { bg: 'var(--badge-awaiting-bg)', fg: 'var(--badge-awaiting-fg)' },
};

const SLA_STYLES: Record<SlaStatus, { bg: string; fg: string }> = {
  WITHIN_SLA: { bg: 'var(--badge-approved-bg)', fg: 'var(--badge-approved-fg)' },
  BREACH_SOON: { bg: 'var(--badge-awaiting-bg)', fg: 'var(--badge-awaiting-fg)' },
  BREACHED: { bg: 'var(--badge-declined-bg)', fg: 'var(--badge-declined-fg)' },
};

const PRIORITY_STYLES: Record<'LOW' | 'MEDIUM' | 'HIGH', { bg: string; fg: string }> = {
  LOW: { bg: 'var(--color-surface-2)', fg: 'var(--color-muted)' },
  MEDIUM: { bg: 'var(--badge-awaiting-bg)', fg: 'var(--badge-awaiting-fg)' },
  HIGH: { bg: 'var(--badge-declined-bg)', fg: 'var(--badge-declined-fg)' },
};

function formatStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function formatCurrency(cents?: number | null) {
  if (cents == null) return '—';
  return `R ${(cents / 100).toLocaleString('en-ZA')}`;
}

function formatTerm(termDays: number) {
  if (termDays % 30 === 0) return `${termDays / 30}m`;
  if (termDays % 7 === 0) return `${termDays / 7}w`;
  return `${termDays}d`;
}

function formatAge(ageHours: number) {
  if (ageHours >= 24) {
    const days = Math.floor(ageHours / 24);
    const hours = ageHours % 24;
    return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
  }

  return `${ageHours}h`;
}

function formatApr(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

function getBorrowerName(application: ApiApplication) {
  return application.borrower.individual?.fullName
    ?? application.borrower.business?.legalName
    ?? 'Borrower record';
}

export default function ApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<ApiApplication[]>([]);
  const [filter, setFilter] = useState<WorkflowStatus>('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('submittedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<WorkflowStatus, number>>(EMPTY_STATUS_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [acting, setActing] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [rowAction, setRowAction] = useState<{ id: string; action: 'assign' | 'flag' } | null>(null);
  const deferredSearch = useDeferredValue(search.trim());

  useEffect(() => {
    const controller = new AbortController();

    async function loadApplications() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        status: filter,
        limit: String(PAGE_SIZE),
        offset: String((page - 1) * PAGE_SIZE),
        sortBy: sortKey,
        sortDirection,
      });

      if (deferredSearch) {
        params.set('q', deferredSearch);
      }

      try {
        const headers = await buildOpsApiHeaders();
        const response = await fetch(`${API}/api/v1/applications?${params.toString()}`, {
          headers,
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as (ApplicationsResponse & { error?: string }) | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? 'Unable to load application queue.');
        }

        if (controller.signal.aborted) return;

        const nextTotal = payload?.total ?? 0;
        const nextCounts = { ...EMPTY_STATUS_COUNTS, ...(payload?.statusCounts ?? {}) };
        const lastPage = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));

        setTotal(nextTotal);
        setCounts(nextCounts);
        setActionError(null);

        if (page > lastPage) {
          setPage(lastPage);
          return;
        }

        setApplications(payload?.data ?? []);
      } catch (loadError) {
        if (controller.signal.aborted) return;

        setApplications([]);
        setTotal(0);
        setCounts(EMPTY_STATUS_COUNTS);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load application queue.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadApplications();

    return () => {
      controller.abort();
    };
  }, [deferredSearch, filter, page, refreshKey, sortDirection, sortKey]);

  function changeFilter(nextFilter: WorkflowStatus) {
    setFilter(nextFilter);
    setPage(1);
  }

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortKey(nextKey);
    setSortDirection(nextKey === 'submittedAt' ? 'desc' : 'asc');
    setPage(1);
  }

  async function submitAction(application: ApiApplication, action: 'approve' | 'reject') {
    const overrideReason = action === 'approve'
      ? application.underwriting.recommendation && application.underwriting.recommendation !== 'APPROVE'
        ? 'Manual queue approval overrides the latest AI recommendation.'
        : undefined
      : application.underwriting.recommendation && application.underwriting.recommendation !== 'DECLINE'
        ? 'Manual queue decline overrides the latest AI recommendation.'
        : undefined;

    setActing({ id: application.id, action });
    setActionError(null);

    try {
      const headers = await buildOpsApiHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch(`${API}/api/v1/applications/${application.id}/${action}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rationale: action === 'approve'
            ? 'Approved from the enterprise queue view.'
            : 'Declined from the enterprise queue view.',
          reason: action === 'reject' ? 'Application declined from the enterprise queue view.' : undefined,
          reasonCodes: action === 'reject' ? ['OPS_QUEUE_DECISION'] : undefined,
          overrideReason,
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? `Unable to ${action} application.`);
      }

      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : `Unable to ${action} application.`);
    } finally {
      setActing(null);
    }
  }

  async function submitWorkflowEvent(
    application: ApiApplication,
    type: 'ASSIGNED' | 'FLAGGED',
    payload: Record<string, unknown>,
  ) {
    setRowAction({ id: application.id, action: type === 'ASSIGNED' ? 'assign' : 'flag' });
    setActionError(null);

    try {
      const headers = await buildOpsApiHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch(`${API}/api/v1/applications/${application.id}/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type,
          payload,
        }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? 'Unable to update application workflow.');
      }

      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : 'Unable to update application workflow.');
    } finally {
      setRowAction(null);
    }
  }

  function sortLabel(key: SortKey) {
    if (sortKey !== key) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const fromRecord = total === 0 ? 0 : ((currentPage - 1) * PAGE_SIZE) + 1;
  const toRecord = total === 0 ? 0 : Math.min(((currentPage - 1) * PAGE_SIZE) + applications.length, total);

  return (
    <OpsLayout
      title="Applications"
      action={
        <div className="flex flex-col items-end gap-1">
          <Link
            href="/applications/new"
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--color-primary)', color: '#fff' }}
          >
            + Manual application
          </Link>
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
            Assisted capture for branch, call-centre, or partner walk-ins
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="w-full lg:max-w-md">
            <label className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>
              Search applications
            </label>
            <input
              type="search"
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
              placeholder="Search borrower, email, reference, or loan number"
              className="w-full px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
            />
          </div>

          <div className="rounded-xl px-4 py-3 text-sm min-w-[260px]" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="font-semibold">
              {loading ? 'Loading enterprise queue…' : `Showing ${fromRecord}-${toRecord} of ${total}`}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
              {counts.SUBMITTED} awaiting review · {counts.PENDING_DISBURSEMENT} pending disbursement · sorted by {sortKey === 'submittedAt' ? 'submitted date' : sortKey === 'amountRequested' ? 'amount' : 'term'} ({sortDirection})
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {ALL_STATUSES.map((status) => (
            <button
              key={status}
              onClick={() => changeFilter(status)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors inline-flex items-center gap-2"
              style={{
                background: filter === status ? 'var(--color-primary)' : 'var(--color-surface-2)',
                color: filter === status ? '#fff' : 'var(--color-muted)',
              }}
            >
              <span>{formatStatus(status)}</span>
              <span
                className="min-w-5 px-1.5 py-0.5 rounded-full"
                style={{
                  background: status === 'SUBMITTED' && counts[status] > 0 && filter !== status ? 'var(--badge-pending-bg)' : 'rgba(255,255,255,0.12)',
                  color: status === 'SUBMITTED' && counts[status] > 0 && filter !== status ? 'var(--badge-pending-fg)' : filter === status ? '#fff' : 'var(--color-muted)',
                }}
              >
                {counts[status]}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}>
            {error}
          </div>
        )}

        {actionError && (
          <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}>
            {actionError}
          </div>
        )}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Borrower</th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Assignment</th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Offer</th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>AI / NCA</th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Compliance</th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                <button type="button" onClick={() => toggleSort('submittedAt')} className="inline-flex items-center gap-1 font-medium">
                  <span>Queue</span>
                  <span>{sortLabel('submittedAt')}</span>
                </button>
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && applications.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
                  Loading enterprise application queue…
                </td>
              </tr>
            ) : applications.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
                  No applications match the current filter and search.
                </td>
              </tr>
            ) : (
              applications.map((application, index) => {
                const rowBusy = acting?.id === application.id;
                const rowWorkflowBusy = rowAction?.id === application.id;
                const statusStyle = STATUS_STYLES[application.workflowStatus];
                const slaStyle = SLA_STYLES[application.slaStatus];
                const priorityStyle = PRIORITY_STYLES[application.reviewPriority];

                return (
                  <tr
                    key={application.id}
                    style={{ borderBottom: index < applications.length - 1 ? '1px solid var(--color-border)' : 'none' }}
                    className="hover:bg-[var(--color-surface-2)] transition-colors align-top"
                  >
                    <td className="px-4 py-4">
                      <div className="font-medium">{getBorrowerName(application)}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{application.borrower.email}</div>
                      <div className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>
                        {application.externalRef ?? `APP-${application.id.slice(-8).toUpperCase()}`}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium">{application.assignee?.assignee ?? 'Unassigned'}</div>
                      <div className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>
                        {application.assignee?.assignedAt
                          ? `Assigned ${new Date(application.assignee.assignedAt).toLocaleDateString('en-ZA')}`
                          : 'Queue owner not set'}
                      </div>
                      {application.flag && (
                        <div className="text-[11px] mt-2" style={{ color: 'var(--badge-declined-fg)' }}>
                          Flagged by {application.flag.actor}
                          {application.flag.reason ? ` · ${application.flag.reason}` : ''}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-semibold">{application.product?.name ?? '—'}</div>
                      <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                        {formatCurrency(application.amountRequested)} · {formatTerm(application.termDaysRequested)}
                      </div>
                      <div className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>
                        AI offer: {formatCurrency(application.underwriting.recommendedOffer.amountCents)} · {formatTerm(application.underwriting.recommendedOffer.termDays)} · {formatApr(application.underwriting.recommendedOffer.aprBps)}
                      </div>
                      <div className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>
                        Instalment est: {formatCurrency(application.underwriting.recommendedOffer.estimatedInstallmentCents)}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-semibold">
                        {application.underwriting.recommendation ?? 'Decision pending'}
                        {application.underwriting.riskScore != null && ` · ${application.underwriting.riskScore}/1000`}
                      </div>
                      <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                        Risk band {application.underwriting.riskBand ?? '—'}
                        {application.underwriting.confidencePct != null && ` · ${application.underwriting.confidencePct}% confidence`}
                      </div>
                      <div className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>
                        NCA: {application.affordability.ncaStatus} · DTI {application.affordability.dtiPct != null ? `${application.affordability.dtiPct.toFixed(1)}%` : '—'}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge label={`KYC ${formatStatus(application.compliance.kycStatus)}`} background="var(--color-surface-2)" color="var(--foreground)" />
                        <Badge
                          label={`AML ${application.compliance.amlRisk}`}
                          background={application.compliance.amlRisk === 'HIGH' ? 'var(--badge-declined-bg)' : application.compliance.amlRisk === 'MEDIUM' ? 'var(--badge-awaiting-bg)' : 'var(--badge-approved-bg)'}
                          color={application.compliance.amlRisk === 'HIGH' ? 'var(--badge-declined-fg)' : application.compliance.amlRisk === 'MEDIUM' ? 'var(--badge-awaiting-fg)' : 'var(--badge-approved-fg)'}
                        />
                        <Badge
                          label={`Bureau ${formatStatus(application.compliance.bureauStatus)}`}
                          background={application.compliance.bureauStatus === 'FAILED' ? 'var(--badge-declined-bg)' : application.compliance.bureauStatus === 'PULLED' ? 'var(--badge-approved-bg)' : 'var(--color-surface-2)'}
                          color={application.compliance.bureauStatus === 'FAILED' ? 'var(--badge-declined-fg)' : application.compliance.bureauStatus === 'PULLED' ? 'var(--badge-approved-fg)' : 'var(--foreground)'}
                        />
                      </div>
                      <div className="text-[11px] mt-2" style={{ color: 'var(--color-muted)' }}>
                        Bureau score: {application.compliance.bureauScore ?? '—'} · Internal notes: {application.noteCount}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: statusStyle.bg, color: statusStyle.fg }}>
                          {formatStatus(application.workflowStatus)}
                        </span>
                        <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: slaStyle.bg, color: slaStyle.fg }}>
                          {application.slaStatus === 'WITHIN_SLA' ? 'Within SLA' : application.slaStatus === 'BREACH_SOON' ? 'SLA watch' : 'SLA breached'}
                        </span>
                        <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: priorityStyle.bg, color: priorityStyle.fg }}>
                          {application.reviewPriority} priority
                        </span>
                      </div>
                      {application.status !== application.workflowStatus && (
                        <div className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                          Stage: {formatStatus(application.status)}
                        </div>
                      )}
                      <div className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>
                        Age: {formatAge(application.ageHours)} · Tier: {formatStatus(application.approvalTier)}
                      </div>
                      {application.workflowStatus === 'SUBMITTED' && (
                        <div className="text-[11px] mt-1" style={{ color: application.slaStatus === 'BREACHED' ? 'var(--badge-declined-fg)' : 'var(--color-muted)' }}>
                          {application.ageHours >= 24
                            ? `${Math.floor(application.ageHours / 24)} day${Math.floor(application.ageHours / 24) === 1 ? '' : 's'} unreviewed`
                            : `${application.ageHours} hours unreviewed`}
                        </div>
                      )}
                      <div className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>
                        Submitted {new Date(application.submittedAt).toLocaleDateString('en-ZA')}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <button
                          onClick={() => router.push(`/applications/${application.id}`)}
                          className="text-xs font-semibold"
                          style={{ color: 'var(--color-secondary)' }}
                        >
                          Open review →
                        </button>

                        <button
                          type="button"
                          onClick={() => submitWorkflowEvent(application, 'ASSIGNED', {
                            assignee: getSession()?.name ?? 'Ops user',
                            queue: 'underwriting',
                          })}
                          disabled={rowWorkflowBusy}
                          className="text-xs font-semibold px-2.5 py-1 rounded-full disabled:opacity-50"
                          style={{ background: 'var(--color-surface-2)', color: 'var(--foreground)', border: '1px solid var(--color-border)' }}
                        >
                          {rowWorkflowBusy && rowAction?.action === 'assign' ? 'Assigning…' : 'Assign to me'}
                        </button>

                        <button
                          type="button"
                          onClick={() => submitWorkflowEvent(application, 'FLAGGED', {
                            reason: 'Flagged from the queue for manual escalation.',
                            severity: application.reviewPriority === 'HIGH' ? 'HIGH' : 'MEDIUM',
                          })}
                          disabled={rowWorkflowBusy}
                          className="text-xs font-semibold px-2.5 py-1 rounded-full disabled:opacity-50"
                          style={{ background: 'var(--badge-awaiting-bg)', color: 'var(--badge-awaiting-fg)' }}
                        >
                          {rowWorkflowBusy && rowAction?.action === 'flag' ? 'Flagging…' : application.flag ? 'Update flag' : 'Flag'}
                        </button>

                        {application.canApprove && (
                          <button
                            type="button"
                            onClick={() => submitAction(application, 'approve')}
                            disabled={rowBusy}
                            className="text-xs font-semibold px-2.5 py-1 rounded-full disabled:opacity-50"
                            style={{ background: 'var(--badge-approved-bg)', color: 'var(--badge-approved-fg)' }}
                          >
                            {rowBusy && acting?.action === 'approve' ? 'Approving…' : 'Approve'}
                          </button>
                        )}

                        {application.canReject && (
                          <button
                            type="button"
                            onClick={() => submitAction(application, 'reject')}
                            disabled={rowBusy}
                            className="text-xs font-semibold px-2.5 py-1 rounded-full disabled:opacity-50"
                            style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}
                          >
                            {rowBusy && acting?.action === 'reject' ? 'Rejecting…' : 'Reject'}
                          </button>
                        )}

                        {application.workflowStatus === 'PENDING_DISBURSEMENT' && (
                          <button
                            type="button"
                            onClick={() => router.push(`/applications/${application.id}`)}
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: 'var(--badge-awaiting-bg)', color: 'var(--badge-awaiting-fg)' }}
                          >
                            Prep payout
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 mt-4 md:flex-row md:items-center md:justify-between">
        <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
          Total applications: {counts.ALL}. Current queue: {counts.SUBMITTED} submitted, {counts.PENDING_DISBURSEMENT} pending disbursement.
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={currentPage === 1 || loading}
            className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
          >
            Previous
          </button>
          <span className="text-xs px-3" style={{ color: 'var(--color-muted)' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={currentPage === totalPages || loading}
            className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)' }}
          >
            Next
          </button>
        </div>
      </div>
    </OpsLayout>
  );
}

function Badge({ label, background, color }: { label: string; background: string; color: string }) {
  return (
    <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background, color }}>
      {label}
    </span>
  );
}