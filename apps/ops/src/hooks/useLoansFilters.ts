"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type LoansFilters = {
  status: string;
  product: string;
  minDpd: number;
  maxDpd: number;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
};

const DEFAULT_FILTERS: LoansFilters = {
  status: '',
  product: '',
  minDpd: 0,
  maxDpd: 0,
  search: '',
  sortBy: 'dpd',
  sortOrder: 'desc',
  page: 1,
  pageSize: 20,
};

function parseNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseSortOrder(value: string | null): 'asc' | 'desc' {
  return value === 'asc' ? 'asc' : 'desc';
}

function toSearchParams(filters: LoansFilters) {
  const params = new URLSearchParams();

  if (filters.status) params.set('status', filters.status);
  if (filters.product) params.set('product', filters.product);
  if (filters.minDpd > 0) params.set('minDpd', String(filters.minDpd));
  if (filters.maxDpd > 0) params.set('maxDpd', String(filters.maxDpd));
  if (filters.search) params.set('search', filters.search);
  if (filters.sortBy !== DEFAULT_FILTERS.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder !== DEFAULT_FILTERS.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.pageSize !== DEFAULT_FILTERS.pageSize) params.set('pageSize', String(filters.pageSize));

  return params;
}

function parseFilters(searchParams: URLSearchParams): LoansFilters {
  return {
    status: searchParams.get('status') ?? DEFAULT_FILTERS.status,
    product: searchParams.get('product') ?? DEFAULT_FILTERS.product,
    minDpd: parseNumber(searchParams.get('minDpd'), DEFAULT_FILTERS.minDpd),
    maxDpd: parseNumber(searchParams.get('maxDpd'), DEFAULT_FILTERS.maxDpd),
    search: searchParams.get('search') ?? DEFAULT_FILTERS.search,
    sortBy: searchParams.get('sortBy') ?? DEFAULT_FILTERS.sortBy,
    sortOrder: parseSortOrder(searchParams.get('sortOrder')),
    page: Math.max(1, parseNumber(searchParams.get('page'), DEFAULT_FILTERS.page)),
    pageSize: Math.max(1, parseNumber(searchParams.get('pageSize'), DEFAULT_FILTERS.pageSize)),
  };
}

export function useLoansFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = searchParams?.toString() ?? '';
  const initialFilters = useMemo(() => parseFilters(searchParams ?? new URLSearchParams()), [currentSearch]);
  const [filters, setFilters] = useState<LoansFilters>(initialFilters);

  useEffect(() => {
    setFilters(parseFilters(searchParams ?? new URLSearchParams()));
  }, [currentSearch]);

  const pushFilters = (next: LoansFilters) => {
    const params = toSearchParams(next);
    router.replace(`/loans${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const updateFilters = (changes: Partial<LoansFilters>) => {
    setFilters((current) => {
      const next = { ...current, ...changes };
      pushFilters(next);
      return next;
    });
  };

  const setStatus = (status: string) => updateFilters({ status, page: 1 });
  const setProduct = (product: string) => updateFilters({ product, page: 1 });
  const setDpdRange = (minDpd: number, maxDpd: number) => updateFilters({ minDpd, maxDpd, page: 1 });
  const setSearch = (search: string) => updateFilters({ search, page: 1 });
  const setSortBy = (sortBy: string) => updateFilters({ sortBy, page: 1 });
  const setSortOrder = (sortOrder: 'asc' | 'desc') => updateFilters({ sortOrder, page: 1 });
  const setPage = (page: number) => updateFilters({ page });
  const setPageSize = (pageSize: number) => updateFilters({ pageSize, page: 1 });
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    router.replace('/loans');
  };

  return {
    filters,
    setStatus,
    setProduct,
    setDpdRange,
    setSearch,
    setSortBy,
    setSortOrder,
    setPage,
    setPageSize,
    resetFilters,
  };
}
