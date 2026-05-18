'use client';

import { useState, useEffect } from 'react';
import PartnerLayout           from '@/app/_components/PartnerLayout';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

type Product = {
  id: string; name: string; description?: string;
  minAmount: number; maxAmount: number;
  minTermMonths: number; maxTermMonths: number;
  aprBps: number; fees?: string;
};

export default function PartnerProducts() {
  const [data,    setData]    = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/products`, { headers: { Authorization: 'Bearer demo' } })
      .then(r => r.json())
      .then(j => { setData(j.data ?? []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <PartnerLayout title="Products">
      {loading && <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</p>}
      {error   && <p className="text-sm" style={{ color: 'var(--badge-declined-fg)' }}>{error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.map(p => (
            <div
              key={p.id}
              className="rounded-2xl p-6 flex flex-col gap-4"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div>
                <div className="font-bold text-lg mb-1">{p.name}</div>
                {p.description && (
                  <div className="text-sm" style={{ color: 'var(--color-muted)' }}>{p.description}</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>Loan range</div>
                  <div className="font-semibold">
                    R {(p.minAmount / 100).toLocaleString()} – R {(p.maxAmount / 100).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>Term range</div>
                  <div className="font-semibold">{p.minTermMonths} – {p.maxTermMonths} months</div>
                </div>
                <div>
                  <div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>APR</div>
                  <div className="font-semibold text-base" style={{ color: 'var(--color-secondary)' }}>
                    {(p.aprBps / 100).toFixed(1)}%
                  </div>
                </div>
                {p.fees && (
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: 'var(--color-muted)' }}>Fees</div>
                    <div className="font-semibold">{p.fees}</div>
                  </div>
                )}
              </div>

              <a
                href="/applications/new"
                className="mt-auto text-center py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--color-primary)', color: 'var(--color-primary-fg)' }}
              >
                Apply with this product →
              </a>
            </div>
          ))}

          {data.length === 0 && (
            <div className="col-span-3 rounded-xl p-10 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No products available.</p>
            </div>
          )}
        </div>
      )}
    </PartnerLayout>
  );
}
