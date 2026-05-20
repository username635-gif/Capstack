"use client";

import { useDeferredValue, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import OpsLayout from '@/app/_components/OpsLayout';
import { getSession } from '@/lib/session';
import { API_BASE_URL as API, buildOpsApiHeaders } from '@/lib/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

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
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<WorkflowStatus>('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('submittedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [rowAction, setRowAction] = useState<{ id: string; action: 'assign' | 'flag' } | null>(null);
  const deferredSearch = useDeferredValue(search.trim());

  async function fetchApplications({ queryKey }: { queryKey: any }) {
    const [_key, { filter, search, page, sortKey, sortDirection }] = queryKey;
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
      sortBy: sortKey,
      sortDirection,
    });

    if (filter !== 'ALL') params.set('status', filter);
    if (search) params.set('q', search);

    const headers = await buildOpsApiHeaders();
    const res = await fetch(`${API}/api/v1/applications?${params.toString()}`, { headers, cache: 'no-store' });
    const payload = await res.json().catch(() => null) as (ApplicationsResponse & { error?: string }) | null;
    if (!res.ok) throw new Error(payload?.error ?? 'Unable to load application queue.');
    return payload as ApplicationsResponse;
  }

  const { data, isLoading, error } = useQuery(
    ['applications', { filter, search: deferredSearch, page, sortKey, sortDirection }],
    fetchApplications,
    { keepPreviousData: true }
  );

  const applications = data?.data ?? [];
  const total = data?.total ?? 0;
  const counts = { ...EMPTY_STATUS_COUNTS, ...(data?.statusCounts ?? {}) };

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

      await queryClient.invalidateQueries(['applications']);
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

      await queryClient.invalidateQueries(['applications']);
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

  // TanStack columns
  const columnHelper = createColumnHelper<ApiApplication>();

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'borrower',
      header: 'Borrower',
      cell: (info) => {
        const app = info.row.original;
        return (
          <div>
            <div className="font-medium">{getBorrowerName(app)}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{app.borrower.email}</div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>{app.externalRef ?? `APP-${app.id.slice(-8).toUpperCase()}`}</div>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'assignment',
      header: 'Assignment',
      cell: (info) => {
        const app = info.row.original;
        return (
          <div>
            <div className="font-medium">{app.assignee?.assignee ?? 'Unassigned'}</div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>{app.assignee?.assignedAt ? `Assigned ${new Date(app.assignee.assignedAt).toLocaleDateString('en-ZA')}` : 'Queue owner not set'}</div>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'offer',
      header: 'Offer',
      cell: (info) => {
        const app = info.row.original;
        return (
          <div>
            <div className="font-semibold">{app.product?.name ?? '—'}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{formatCurrency(app.amountRequested)} · {formatTerm(app.termDaysRequested)}</div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>AI offer: {formatCurrency(app.underwriting.recommendedOffer.amountCents)} · {formatTerm(app.underwriting.recommendedOffer.termDays)} · {formatApr(app.underwriting.recommendedOffer.aprBps)}</div>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'ai',
      header: 'AI / NCA',
      cell: (info) => {
        const app = info.row.original;
        return (
          <div>
            <div className="font-semibold">{app.underwriting.recommendation ?? 'Decision pending'}{app.underwriting.riskScore != null && ` · ${app.underwriting.riskScore}/1000`}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>Risk band {app.underwriting.riskBand ?? '—'}{app.underwriting.confidencePct != null && ` · ${app.underwriting.confidencePct}% confidence`}</div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>NCA: {app.affordability.ncaStatus} · DTI {app.affordability.dtiPct != null ? `${app.affordability.dtiPct.toFixed(1)}%` : '—'}</div>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'compliance',
      header: 'Compliance',
      cell: (info) => {
        const c = info.row.original.compliance;
        return (
          <div>
            <div className="flex flex-wrap gap-1.5">
              <Badge label={`KYC ${formatStatus(c.kycStatus)}`} background="var(--color-surface-2)" color="var(--foreground)" />
              <Badge label={`AML ${c.amlRisk}`} background={c.amlRisk === 'HIGH' ? 'var(--badge-declined-bg)' : c.amlRisk === 'MEDIUM' ? 'var(--badge-awaiting-bg)' : 'var(--badge-approved-bg)'} color={c.amlRisk === 'HIGH' ? 'var(--badge-declined-fg)' : c.amlRisk === 'MEDIUM' ? 'var(--badge-awaiting-fg)' : 'var(--badge-approved-fg)'} />
              <Badge label={`Bureau ${formatStatus(c.bureauStatus)}`} background={c.bureauStatus === 'FAILED' ? 'var(--badge-declined-bg)' : c.bureauStatus === 'PULLED' ? 'var(--badge-approved-bg)' : 'var(--color-surface-2)'} color={c.bureauStatus === 'FAILED' ? 'var(--badge-declined-fg)' : c.bureauStatus === 'PULLED' ? 'var(--badge-approved-fg)' : 'var(--foreground)'} />
            </div>
            <div className="text-[11px] mt-2" style={{ color: 'var(--color-muted)' }}>Bureau score: {c.bureauScore ?? '—'}</div>
          </div>
        );
      },
    }),
    columnHelper.accessor('submittedAt', {
      id: 'queue',
      header: () => (
        <button type="button" onClick={() => toggleSort('submittedAt')} className="inline-flex items-center gap-1 font-medium">
          <span>Queue</span>
          <span>{sortLabel('submittedAt')}</span>
        </button>
      ),
      cell: (info) => {
        const app = info.row.original;
        const statusStyle = STATUS_STYLES[app.workflowStatus];
        const slaStyle = SLA_STYLES[app.slaStatus];
        const priorityStyle = PRIORITY_STYLES[app.reviewPriority];

        return (
          <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: statusStyle.bg, color: statusStyle.fg }}>{formatStatus(app.workflowStatus)}</span>
              <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: slaStyle.bg, color: slaStyle.fg }}>{app.slaStatus === 'WITHIN_SLA' ? 'Within SLA' : app.slaStatus === 'BREACH_SOON' ? 'SLA watch' : 'SLA breached'}</span>
              <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold" style={{ background: priorityStyle.bg, color: priorityStyle.fg }}>{app.reviewPriority} priority</span>
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>Submitted {new Date(app.submittedAt).toLocaleDateString('en-ZA')}</div>
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const app = info.row.original;
        const rowBusy = acting?.id === app.id;
        const rowWorkflowBusy = rowAction?.id === app.id;

        return (
          <div className="flex flex-col items-start gap-2">
            <button onClick={() => router.push(`/applications/${app.id}`)} className="text-xs font-semibold" style={{ color: 'var(--color-secondary)' }}>Open review →</button>
            <button type="button" onClick={() => submitWorkflowEvent(app, 'ASSIGNED', { assignee: getSession()?.name ?? 'Ops user', queue: 'underwriting' })} disabled={rowWorkflowBusy} className="text-xs font-semibold px-2.5 py-1 rounded-full disabled:opacity-50" style={{ background: 'var(--color-surface-2)', color: 'var(--foreground)', border: '1px solid var(--color-border)' }}>{rowWorkflowBusy && rowAction?.action === 'assign' ? 'Assigning…' : 'Assign to me'}</button>
            <button type="button" onClick={() => submitWorkflowEvent(app, 'FLAGGED', { reason: 'Flagged from the queue for manual escalation.', severity: app.reviewPriority === 'HIGH' ? 'HIGH' : 'MEDIUM' })} disabled={rowWorkflowBusy} className="text-xs font-semibold px-2.5 py-1 rounded-full disabled:opacity-50" style={{ background: 'var(--badge-awaiting-bg)', color: 'var(--badge-awaiting-fg)' }}>{rowWorkflowBusy && rowAction?.action === 'flag' ? 'Flagging…' : app.flag ? 'Update flag' : 'Flag'}</button>
            {app.canApprove && <button type="button" onClick={() => submitAction(app, 'approve')} disabled={rowBusy} className="text-xs font-semibold px-2.5 py-1 rounded-full disabled:opacity-50" style={{ background: 'var(--badge-approved-bg)', color: 'var(--badge-approved-fg)' }}>{rowBusy && acting?.action === 'approve' ? 'Approving…' : 'Approve'}</button>}
            {app.canReject && <button type="button" onClick={() => submitAction(app, 'reject')} disabled={rowBusy} className="text-xs font-semibold px-2.5 py-1 rounded-full disabled:opacity-50" style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}>{rowBusy && acting?.action === 'reject' ? 'Rejecting…' : 'Reject'}</button>}
            {app.workflowStatus === 'PENDING_DISBURSEMENT' && <button type="button" onClick={() => router.push(`/applications/${app.id}`)} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--badge-awaiting-bg)', color: 'var(--badge-awaiting-fg)' }}>Prep payout</button>}
          </div>
        );
      },
    }),
  ] as const, [acting, rowAction, router]);

  const table = useReactTable({ data: applications, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <OpsLayout
      title="Applications"
      action={
        <div className="flex flex-col items-end gap-1">
          <Link
            href="/applications/new"
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
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
            <label htmlFor="search-applications" className="text-xs font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--color-muted)' }}>
              Search applications
            </label>
            <input
              id="search-applications"
              type="search"
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
              placeholder="Search borrower, email, reference, or loan number"
              className="w-full px-4 py-3 rounded-lg text-sm focus:outline-2 focus:outline-offset-2"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outlineColor: 'var(--color-primary)' }}
              aria-describedby="search-hint"
            />
            <div id="search-hint" className="text-[11px] mt-1" style={{ color: 'var(--color-muted)' }}>Type borrower name, email, or reference to filter</div>
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
              type="button"
              onClick={() => changeFilter(status)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors inline-flex items-center gap-2 focus:outline-2 focus:outline-offset-2"
              style={{
                background: filter === status ? 'var(--color-primary)' : 'var(--color-surface-2)',
                color: filter === status ? 'var(--color-primary-fg)' : 'var(--color-muted)',
                outlineColor: 'var(--color-primary)',
              }}
            >
              <span>{formatStatus(status)}</span>
              <span
                className="min-w-5 px-1.5 py-0.5 rounded-full"
                style={{
                  background: filter === status
                    ? 'var(--color-surface-2)'
                    : status === 'SUBMITTED' && counts[status] > 0
                      ? 'var(--badge-pending-bg)'
                      : 'rgba(255,255,255,0.12)',
                  color: status === 'SUBMITTED' && counts[status] > 0 && filter !== status
                    ? 'var(--badge-pending-fg)'
                    : filter === status
                      ? 'var(--color-primary-fg)'
                      : 'var(--color-muted)',
                }}
              >
                {counts[status]}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }} role="alert" aria-live="polite">
            {error}
          </div>
        )}

        {actionError && (
          <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }} role="alert" aria-live="assertive">
            {actionError}
          </div>
        )}
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                {hg.headers.map((header) => (
                  <th key={header.id} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody>
            {isLoading && applications.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
                  Loading enterprise application queue…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--color-muted)' }}>
                  No applications match the current filter and search.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--color-surface-2)] transition-colors align-top" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
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
            disabled={currentPage === 1 || isLoading}
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
            disabled={currentPage === totalPages || isLoading}
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