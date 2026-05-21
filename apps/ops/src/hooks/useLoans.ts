"use client";

import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL, buildOpsApiHeaders } from '@/lib/api-client';

export type LoansQueryFilters = {
  status?: string;
  product?: string;
  minDpd?: number;
  maxDpd?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export type LoanSummary = {
  activeCount: number;
  totalOutstanding: number;
  atRiskCount: number;
  atRiskExposure: number;
  defaultedCount: number;
  defaultedExposure: number;
};

export type LoanItem = {
  id: string;
  loanNumber: string;
  status: string;
  daysPastDue: number;
  principal: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
  outstandingFees: number;
  outstandingTotal: number;
  aprBps: number;
  termDays: number;
  disbursedAt: string | null;
  maturityDate: string | null;
  borrower: {
    id: string;
    name: string;
    email: string;
    phone: string;
    riskRating?: string | null;
    monthlyIncome?: number | null;
  };
  product: {
    id: string;
    name: string;
    type: string;
  };
  ai: {
    decision: string;
    confidence: number;
    scoreband: string;
    modelVersion: string;
    processedAt: string | null;
  } | null;
};

export type LoansResponse = {
  loans: LoanItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: LoanSummary;
};

function toQueryString(filters: LoansQueryFilters): string {
  const params = new URLSearchParams();

  if (filters.status) params.set('status', filters.status);
  if (filters.product) params.set('product', filters.product);
  if (typeof filters.minDpd === 'number') params.set('minDpd', String(filters.minDpd));
  if (typeof filters.maxDpd === 'number') params.set('maxDpd', String(filters.maxDpd));
  if (filters.search) params.set('search', filters.search);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (typeof filters.page === 'number') params.set('page', String(filters.page));
  if (typeof filters.pageSize === 'number') params.set('pageSize', String(filters.pageSize));

  return params.toString();
}

async function fetchLoans(filters: LoansQueryFilters): Promise<LoansResponse> {
  const query = toQueryString(filters);
  const headers = await buildOpsApiHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/loans${query ? `?${query}` : ''}`, {
    headers,
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as any).error === 'string'
        ? (payload as any).error
        : 'Unable to load loans.';
    throw new Error(message);
  }

  return payload as LoansResponse;
}

export function useLoans(filters: LoansQueryFilters) {
  return useQuery<LoansResponse, Error>({
    queryKey: ['loans', filters],
    queryFn: () => fetchLoans(filters),
    staleTime: 1000 * 60,
  });
}
