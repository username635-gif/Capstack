'use client';

import { useState, useEffect } from 'react';
import PartnerLayout           from '@/app/_components/PartnerLayout';
import { getSession }          from '@/lib/session';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://capstack-api.vercel.app';

type Credential = {
  id: string; keyId: string; description?: string;
  isActive: boolean; createdAt: string; lastUsedAt?: string | null;
};

export default function ApiKeysPage() {
  const [creds,    setCreds]    = useState<Credential[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // New key form
  const [description, setDescription] = useState('');
  const [creating,    setCreating]    = useState(false);
  const [newKey,      setNewKey]      = useState<{ keyId: string; secret: string } | null>(null);

  // Revoke state
  const [revoking, setRevoking] = useState<string | null>(null);

  function load() {
    const s = getSession();
    if (!s) return;
    setLoading(true);
    fetch(`${API}/api/v1/api-credentials?partnerId=${s.id}`, { headers: { Authorization: 'Bearer demo' } })
      .then(r => r.json())
      .then(j => { setCreds(j.data ?? []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function createKey() {
    const s = getSession();
    if (!s) return;
    setCreating(true);
    const res  = await fetch(`${API}/api/v1/api-credentials`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer demo' },
      body:    JSON.stringify({ partnerId: s.id, description }),
    });
    const json = await res.json();
    setCreating(false);
    if (!res.ok) { setError(json.error ?? 'Failed to create API key.'); return; }
    setNewKey({ keyId: json.keyId, secret: json.rawSecret });
    setDescription('');
    load();
  }

  async function revokeKey(id: string) {
    if (!confirm('Revoke this API key? Applications using it will stop working immediately.')) return;
    setRevoking(id);
    await fetch(`${API}/api/v1/api-credentials/${id}`, {
      method:  'DELETE',
      headers: { Authorization: 'Bearer demo' },
    });
    setRevoking(null);
    load();
  }

  return (
    <PartnerLayout title="API Keys">
      <div className="max-w-2xl flex flex-col gap-6">

        {/* One-time secret banner */}
        {newKey && (
          <div className="rounded-xl p-5" style={{ background: '#ecfdf5', border: '1px solid #6ee7b7' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-green-800 mb-2">✓ API key created — save your secret now</p>
                <p className="text-xs text-green-700 mb-3">This secret will not be shown again.</p>
                <div className="grid grid-cols-1 gap-2 text-xs font-mono">
                  <div><span className="font-bold">Key ID:</span> <span className="text-green-900">{newKey.keyId}</span></div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">Secret:</span>
                    <code
                      className="px-2 py-1 rounded text-green-900"
                      style={{ background: '#d1fae5', userSelect: 'all', wordBreak: 'break-all' }}
                    >
                      {newKey.secret}
                    </code>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setNewKey(null)}
                className="text-green-700 text-lg font-bold shrink-0"
                title="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Create new key */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-muted)' }}>Generate a new API key</h3>
          <div className="flex gap-3">
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description (e.g. Production server)"
              className="flex-1 px-4 py-3 rounded-lg text-sm"
              style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', color: 'var(--foreground)', outline: 'none' }}
            />
            <button
              onClick={createKey}
              disabled={creating}
              className="px-6 py-3 rounded-lg text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
              style={{ background: 'var(--color-primary)', color: '#fff' }}
            >
              {creating ? 'Creating…' : '+ Generate'}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'var(--badge-declined-bg)', color: 'var(--badge-declined-fg)' }}>{error}</div>
        )}

        {/* Keys list */}
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</p>
        ) : creds.length === 0 ? (
          <div className="rounded-xl p-10 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>No API keys yet. Generate one above.</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                  {['Key ID','Description','Created','Last used','Status',''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--color-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {creds.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i < creds.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                    <td className="px-4 py-3 font-mono text-xs">{c.keyId}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-muted)' }}>{c.description ?? '—'}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted)' }}>{new Date(c.createdAt).toLocaleDateString('en-ZA')}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                      {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleDateString('en-ZA') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold" style={{ color: c.isActive ? 'var(--badge-approved-fg)' : 'var(--color-muted)' }}>
                        {c.isActive ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.isActive && (
                        <button
                          onClick={() => revokeKey(c.id)}
                          disabled={revoking === c.id}
                          className="text-xs font-semibold disabled:opacity-40"
                          style={{ color: 'var(--badge-declined-fg)' }}
                        >
                          {revoking === c.id ? 'Revoking…' : 'Revoke'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PartnerLayout>
  );
}
