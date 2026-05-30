"use client";

// Ops Applications queue page (hybrid: live-backed when API is reachable, otherwise demo data).
//
// NOTE:
// - This file must be a Client Component (uses react hooks).
// - Demo blocks exist to keep every nav target populated even when the API returns
//   empty/null/throws.

import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import OpsLayout from '@/app/_components/OpsLayout';
import { getSession } from '@/lib/session';
import { API_BASE_URL as API } from '@/lib/api-client';
import type {
  WorkflowStatus,
  SlaStatus,
  AmlRisk,
  BureauStatus,
  ApprovalTier,
  ReviewPriority,
} from '@capstack/types';

type SortKey = 'amountRequested' | 'termDaysRequested' | 'submittedAt';
type SortDirection = 'asc' | 'desc';

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
  product?: { id: string; name: string } | null;
  loan?: { status: string; loanNumber?: string | null } | null;
  canApprove: boolean;
  canReject: boolean;
  assignee?: { assignee: string; assignedAt: string; actor?: string | null } | null;
  flag?: { id: string; actor: string; createdAt: string; reason: string | null } | null;
  noteCount: number;
  ageHours: number;
  slaStatus: SlaStatus;
  approvalTier: ApprovalTier;
  reviewPriority: ReviewPriority;
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
    amlRisk: AmlRisk;
    bureauStatus: BureauStatus;
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

const PAGE_SIZE = 5;

const ALL_STATUSES: WorkflowStatus[] = ['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PENDING_DISBURSEMENT'];

// Demo fallback data (keeps page populated for design verification and offline dev).
const DEMO_APPLICATIONS: ApiApplication[] = [
  {
    id: 'app1',
    externalRef: 'EXT-2026-001',
    status: 'AI_APPROVED',
    workflowStatus: 'APPROVED',
    amountRequested: 2500000,
    termDaysRequested: 365,
    submittedAt: '2026-01-12',
    borrower: {
      id: 'b1',
      email: 'jane.doe@email.com',
      type: 'INDIVIDUAL',
      individual: { fullName: 'Jane Doe' },
      business: null,
    },
    product: { id: 'p1', name: 'Personal Loan' },
    loan: { status: 'ACTIVE', loanNumber: 'LN-2026-00091' },
    canApprove: false,
    canReject: true,
    assignee: null,
    flag: null,
    noteCount: 2,
    ageHours: 12,
    slaStatus: 'WITHIN_SLA',
    approvalTier: 'TIER_1' as ApprovalTier,
    reviewPriority: 'MEDIUM',
    underwriting: {
      recommendation: 'APPROVE',
      riskBand: 'A',
      riskScore: 720,
      confidencePct: 98,
      recommendedOffer: {
        amountCents: 2500000,
        termDays: 365,
        aprBps: 1800,
        estimatedInstallmentCents: 220000,
      },
    },
    compliance: { kycStatus: 'VERIFIED', amlRisk: 'LOW', bureauStatus: 'PULLED', bureauScore: 690 },
    affordability: { canAfford: true, dtiPct: 32.1, ncaStatus: 'PASS' },
  },
  {
    id: 'app2',
    externalRef: 'EXT-2026-002',
    status: 'AI_DECLINED',
    workflowStatus: 'REJECTED',
    amountRequested: 1200000,
    termDaysRequested: 180,
    submittedAt: '2026-02-10',
    borrower: {
      id: 'b2',
      email: 'john.smith@email.com',
      type: 'INDIVIDUAL',
      individual: { fullName: 'John Smith' },
      business: null,
    },
    product: { id: 'p2', name: 'Business Loan' },
    loan: null,
    canApprove: false,
    canReject: false,
    assignee: null,
    flag: null,
    noteCount: 1,
    ageHours: 30,
    slaStatus: 'BREACHED',
    approvalTier: 'TIER_2' as ApprovalTier,
    reviewPriority: 'HIGH',
    underwriting: {
      recommendation: 'DECLINE',
      riskBand: 'C',
      riskScore: 540,
      confidencePct: 80,
      recommendedOffer: {
        amountCents: 0,
        termDays: 0,
        aprBps: 0,
        estimatedInstallmentCents: 0,
      },
    },
    compliance: { kycStatus: 'VERIFIED', amlRisk: 'HIGH', bureauStatus: 'FAILED', bureauScore: 520 },
    affordability: { canAfford: false, dtiPct: 67.2, ncaStatus: 'FAIL' },
  },
  {
    id: 'app3',
    externalRef: 'EXT-2026-003',
    status: 'AI_ESCALATED',
    workflowStatus: 'PENDING_DISBURSEMENT',
    amountRequested: 800000,
    termDaysRequested: 120,
    submittedAt: '2026-03-05',
    borrower: {
      id: 'b3',
      email: 'sam.lee@email.com',
      type: 'INDIVIDUAL',
      individual: { fullName: 'Sam Lee' },
      business: null,
    },
    product: { id: 'p3', name: 'Vehicle Finance' },
    loan: null,
    canApprove: false,
    canReject: false,
    assignee: { assignee: 'ops@capstack.local', assignedAt: '2026-03-06', actor: 'SYSTEM' },
    flag: { id: 'f3', actor: 'AML', createdAt: '2026-03-06', reason: 'Escalated due to anomalies in income pattern' },
    noteCount: 3,
    ageHours: 6,
    slaStatus: 'BREACH_SOON',
    approvalTier: 'TIER_3' as ApprovalTier,
    reviewPriority: 'HIGH',
    underwriting: {
      recommendation: 'ESCALATE',
      riskBand: 'B',
      riskScore: 610,
      confidencePct: 72,
      recommendedOffer: {
        amountCents: 760000,
        termDays: 120,
        aprBps: 2150,
        estimatedInstallmentCents: 9800,
      },
    },
    compliance: { kycStatus: 'VERIFIED', amlRisk: 'MEDIUM', bureauStatus: 'PULLED', bureauScore: 600 },
    affordability: { canAfford: null, dtiPct: null, ncaStatus: 'REVIEW' },
  },
];

function formatMoney(cents: number) {
  return `R ${(cents / 100).toLocaleString('en-ZA')}`;
}

export default function ApplicationsPage() {
  const router = useRouter();

  const [status, setStatus] = useState<WorkflowStatus>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('submittedAt');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const session = getSession();

  const demoMode = process.env.NEXT_PUBLIC_OPS_AUTH_MODE === 'demo';
  const enabled = !demoMode && Boolean(session);

  // Live data: when reachable return it, otherwise fallback to DEMO_APPLICATIONS.
  const { data, isLoading } = useQuery<ApplicationsResponse>({
    queryKey: ['ops:applications', status, sortKey, sortDir, session?.id],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? API}/api/v1/applications/ops?status=${status}`, {
        headers: { Authorization: 'Bearer demo' },
      });
      const json = (await res.json()) as Partial<ApplicationsResponse>;
      return {
        data: (json.data ?? []) as ApiApplication[],
        total: json.total ?? (json.data?.length ?? 0),
        statusCounts: (json.statusCounts ?? {}) as Record<WorkflowStatus, number>,
      };
    },
    enabled,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
  });

  const applications = (demoMode
    ? DEMO_APPLICATIONS
    : (data?.data && data.data.length > 0 ? data.data : DEMO_APPLICATIONS)) as ApiApplication[];

  const columns = useMemo<ColumnDef<ApiApplication>[]>(
    () => [
      {
        accessorKey: 'externalRef',
        header: 'Reference',
        cell: ({ row }) => <span className="text-xs">{row.original.externalRef ?? '—'}</span>,
      },
      {
        accessorKey: 'product',
        header: 'Product',
        cell: ({ row }) => <span className="text-xs">{row.original.product?.name ?? '—'}</span>,
      },
      {
        accessorKey: 'amountRequested',
        header: 'Amount',
        cell: ({ row }) => <span className="text-sm font-semibold">{formatMoney(row.original.amountRequested)}</span>,
      },
      {
        accessorKey: 'submittedAt',
        header: 'Submitted',
        cell: ({ row }) => (
          <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
            {new Date(row.original.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        ),
      },
      {
        accessorKey: 'workflowStatus',
        header: 'Status',
        cell: ({ row }) => (
          <span className="text-xs font-semibold" style={{ background: 'var(--color-surface-2)', color: 'var(--foreground)', padding: '3px 8px', borderRadius: 999 }}>
            {row.original.workflowStatus.replace(/_/g, ' ')}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Link
              href={`/applications/${row.original.id}`}
              className="text-xs font-semibold px-3 py-1 rounded-md"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', cursor: 'pointer', textDecoration: 'none' }}
            >
              View
            </Link>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: applications,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <OpsLayout title="Applications">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-xl font-bold">Applications queue</h1>
          <div className="ml-auto flex items-center gap-2">
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className="text-xs font-semibold px-3 py-1 rounded-md"
                style={{
                  background: status === s ? 'var(--color-primary)' : 'var(--color-surface-2)',
                  color: status === s ? 'var(--color-primary-fg)' : 'var(--foreground)',
                  border: status === s ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <table className="min-w-[700px] w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {hg.headers.map((header) => (
                    <th key={header.id} className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-5 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {!isLoading && applications.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-10" style={{ color: 'var(--color-muted)' }}>
                    No applications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </OpsLayout>
  );
}

