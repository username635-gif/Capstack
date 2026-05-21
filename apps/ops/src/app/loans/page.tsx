'use client';

import { useMemo } from 'react';
import OpsLayout from '@/app/_components/OpsLayout';
import { useLoans } from '@/hooks/useLoans';
import { useLoansFilters } from '@/hooks/useLoansFilters';

const STATUS_OPTIONS = [
  { label: 'All statuses', value: '' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Paid in full', value: 'PAID_IN_FULL' },
  { label: 'Defaulted', value: 'DEFAULTED' },
  { label: 'Written off', value: 'WRITTEN_OFF' },
];

const SORT_OPTIONS = [
  { label: 'DPD', value: 'dpd' },
  { label: 'Outstanding', value: 'outstanding' },
  { label: 'Created', value: 'createdAt' },
];

const PAGE_SIZES = [10, 20, 50];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'var(--badge-active-fg)',
  PAID_IN_FULL: 'var(--badge-approved-fg)',
  DEFAULTED: 'var(--badge-declined-fg)',
  WRITTEN_OFF: 'var(--color-muted)',
};

function formatMoney(cents: number) {
  return `R ${Number(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 0 })}`;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}

export default function LoansPage() {
  const {
    filters,
    setStatus,
    setSearch,
    setDpdRange,
    setSortBy,
    setSortOrder,
    setPage,
    setPageSize,
    resetFilters,
  } = useLoansFilters();

  const { data, error, isLoading, isFetching } = useLoans(filters);

  const loans = data?.loans ?? [];
  const total = data?.total ?? 0;
  const summary = data?.summary;
  const pageCount = useMemo(() => Math.max(1, Math.ceil(total / filters.pageSize)), [total, filters.pageSize]);

  return (
    <OpsLayout title="Loans">
      <div className="grid gap-4 mb-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Active loans</p>
          <p className="mt-3 text-3xl font-semibold">{summary?.activeCount ?? '—'}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Outstanding exposure</p>
          <p className="mt-3 text-3xl font-semibold">{summary ? formatMoney(summary.totalOutstanding) : '—'}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">At-risk loans</p>
          <p className="mt-3 text-3xl font-semibold">{summary?.atRiskCount ?? '—'}</p>
          <p className="text-sm text-[var(--color-muted)]">{summary ? formatMoney(summary.atRiskExposure) : '—'}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Defaulted loans</p>
          <p className="mt-3 text-3xl font-semibold">{summary?.defaultedCount ?? '—'}</p>
          <p className="text-sm text-[var(--color-muted)]">{summary ? formatMoney(summary.defaultedExposure) : '—'}</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="space-y-2 text-sm">
            <span className="text-[var(--color-muted)]">Status</span>
            <select
              value={filters.status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="text-[var(--color-muted)]">Search</span>
            <input
              type="search"
              value={filters.search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Loan #, borrower, product"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-[var(--color-muted)]">Min DPD</span>
              <input
                type="number"
                min={0}
                value={filters.minDpd}
                onChange={(event) => setDpdRange(Number(event.target.value), filters.maxDpd)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-[var(--color-muted)]">Max DPD</span>
              <input
                type="number"
                min={0}
                value={filters.maxDpd}
                onChange={(event) => setDpdRange(filters.minDpd, Number(event.target.value))}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <label className="space-y-2 text-sm">
              <span className="text-[var(--color-muted)]">Sort</span>
              <select
                value={filters.sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-[var(--color-muted)]">Order</span>
              <select
                value={filters.sortOrder}
                onChange={(event) => setSortOrder(event.target.value as 'asc' | 'desc')}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={resetFilters}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-sm font-semibold"
          >
            Reset filters
          </button>
          <p className="text-sm text-[var(--color-muted)]">
            Showing {loans.length} of {total} loans
            {isFetching && ' · Updating…'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--color-surface-2)] text-[var(--color-muted)]">
            <tr>
              {['Loan #', 'Borrower', 'Product', 'Outstanding', 'APR', 'DPD', 'Status', 'Disbursed'].map((heading) => (
                <th key={heading} className="px-4 py-3 font-semibold uppercase tracking-wide">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">Loading loans…</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--color-danger)]">{error.message}</td>
              </tr>
            ) : loans.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">No loans match this filter.</td>
              </tr>
            ) : (
              loans.map((loan, index) => (
                <tr
                  key={loan.id}
                  className={index < loans.length - 1 ? 'border-b border-[var(--color-border)]' : ''}
                >
                  <td className="px-4 py-4 font-mono text-xs">{loan.loanNumber}</td>
                  <td className="px-4 py-4 font-medium">{loan.borrower.name}</td>
                  <td className="px-4 py-4">{loan.product.name}</td>
                  <td className="px-4 py-4">{formatMoney(loan.outstandingTotal)}</td>
                  <td className="px-4 py-4">{(loan.aprBps / 100).toFixed(1)}%</td>
                  <td className="px-4 py-4">{loan.daysPastDue}d</td>
                  <td className="px-4 py-4">
                    <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ background: 'var(--color-surface-2)', color: STATUS_COLORS[loan.status] ?? 'var(--color-muted)' }}>
                      {formatLabel(loan.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4">{formatDate(loan.disbursedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage(Math.max(1, filters.page - 1))}
            disabled={filters.page <= 1}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage(Math.min(pageCount, filters.page + 1))}
            disabled={filters.page >= pageCount}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Next
          </button>
          <span className="text-sm text-[var(--color-muted)]">Page {filters.page} of {pageCount}</span>
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          Page size
          <select
            value={filters.pageSize}
            onChange={(event) => setPageSize(Number(event.target.value))}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>
    </OpsLayout>
  );
}
