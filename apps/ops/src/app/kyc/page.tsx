'use client';

import { useDeferredValue, useEffect, useEffectEvent, useState } from 'react';
import OpsLayout from '@/app/_components/OpsLayout';
import { API_BASE_URL, buildOpsApiHeaders } from '@/lib/api-client';

type ComplianceStatus = 'PENDING' | 'IN_PROGRESS' | 'MANUAL_REVIEW' | 'COMPLETE' | 'FAILED';
type ComplianceRisk = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';

type ComplianceCase = {
  borrowerId: string;
  borrower: {
    name: string;
    email: string;
    phone: string;
    idNumber: string | null;
  };
  ficaDocuments: {
    idVerification: CheckSummary;
    proofOfAddress: CheckSummary;
    liveness: CheckSummary;
  };
  sanctions: {
    sanctions: ScreeningSummary;
    pep: ScreeningSummary;
    ofacStatus: string;
    unStatus: string;
  };
  aml: {
    riskRating: Exclude<ComplianceRisk, 'ALL'>;
    factors: string[];
    openAlertCount: number;
    filedSarCount: number;
  };
  auditTrail: Array<{
    id: string;
    type: string;
    label: string;
    status: string;
    createdAt: string;
    details: string | null;
  }>;
  lastUpdatedAt: string | null;
};

type CheckSummary = {
  status: ComplianceStatus | string;
  provider: string;
  outcome: string | null;
  checkedAt: string | null;
};

type ScreeningSummary = {
  status: ComplianceStatus | string;
  provider: string;
  result: string;
  checkedAt: string | null;
};

type CompliancePayload = {
  generatedAt: string;
  summary: {
    totalBorrowers: number;
    highRiskBorrowers: number;
    pendingFicaDocs: number;
    sanctionsHits: number;
    openAlerts: number;
  };
  cases: ComplianceCase[];
};

const STATUS_STYLES: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: 'var(--badge-pending-bg)', fg: 'var(--badge-pending-fg)' },
  IN_PROGRESS: { bg: 'var(--badge-awaiting-bg)', fg: 'var(--badge-awaiting-fg)' },
  MANUAL_REVIEW: { bg: '#ffedd5', fg: '#9a3412' },
  COMPLETE: { bg: 'var(--badge-approved-bg)', fg: 'var(--badge-approved-fg)' },
  FAILED: { bg: 'var(--badge-declined-bg)', fg: 'var(--badge-declined-fg)' },
};

const RISK_STYLES: Record<Exclude<ComplianceRisk, 'ALL'>, { bg: string; fg: string }> = {
  HIGH: { bg: '#fee2e2', fg: '#991b1b' },
  MEDIUM: { bg: '#fef3c7', fg: '#92400e' },
  LOW: { bg: '#dcfce7', fg: '#166534' },
};

function formatStatus(value: string) {
  return value.replace(/_/g, ' ');
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Pending';
  return new Date(value).toLocaleString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusStyle(status: string) {
  return STATUS_STYLES[status] ?? { bg: 'var(--color-surface-2)', fg: 'var(--color-muted)' };
}

export default function KycPage() {
  const [payload, setPayload] = useState<CompliancePayload | null>(null);
  const [riskFilter, setRiskFilter] = useState<ComplianceRisk>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const loadCompliance = useEffectEvent(async () => {
    setLoading(true);
    setError(null);

    try {
      const headers = await buildOpsApiHeaders();
      const response = await fetch(`${API_BASE_URL}/api/v1/compliance`, {
        headers,
        cache: 'no-store',
      });
      const nextPayload = await response.json().catch(() => null) as (CompliancePayload & { error?: string }) | null;

      if (!response.ok) {
        throw new Error(nextPayload?.error ?? 'Unable to load compliance queue.');
      }

      setPayload(nextPayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load compliance queue.');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadCompliance();
  }, [loadCompliance]);

  const filteredCases = (payload?.cases ?? []).filter((entry) => {
    if (riskFilter !== 'ALL' && entry.aml.riskRating !== riskFilter) {
      return false;
    }

    if (!deferredSearch) {
      return true;
    }

    const haystack = [
      entry.borrower.name,
      entry.borrower.email,
      entry.borrower.phone,
      entry.borrower.idNumber ?? '',
      ...entry.aml.factors,
    ].join(' ').toLowerCase();

    return haystack.includes(deferredSearch);
  });

  function exportCsv() {
    if (filteredCases.length === 0) return;

    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [
      [
        'Borrower',
        'Email',
        'Phone',
        'ID Number',
        'ID Verification',
        'Proof Of Address',
        'Liveness',
        'Sanctions',
        'PEP',
        'OFAC',
        'UN',
        'AML Risk',
        'Open Alerts',
        'SAR Filed',
        'Last Updated',
      ].join(','),
      ...filteredCases.map((entry) => [
        entry.borrower.name,
        entry.borrower.email,
        entry.borrower.phone,
        entry.borrower.idNumber ?? '',
        formatStatus(entry.ficaDocuments.idVerification.status),
        formatStatus(entry.ficaDocuments.proofOfAddress.status),
        formatStatus(entry.ficaDocuments.liveness.status),
        `${formatStatus(entry.sanctions.sanctions.status)} ${entry.sanctions.sanctions.result}`.trim(),
        `${formatStatus(entry.sanctions.pep.status)} ${entry.sanctions.pep.result}`.trim(),
        entry.sanctions.ofacStatus,
        entry.sanctions.unStatus,
        entry.aml.riskRating,
        String(entry.aml.openAlertCount),
        String(entry.aml.filedSarCount),
        entry.lastUpdatedAt ?? '',
      ].map((value) => escape(value)).join(',')),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ncr-compliance-export-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <OpsLayout
      title="KYC / AML"
      action={
        <button
          type="button"
          onClick={exportCsv}
          disabled={filteredCases.length === 0}
          className="text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
          style={{ background: 'var(--color-primary)', color: '#fff' }}
        >
          Export NCR CSV
        </button>
      }
    >
      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Borrowers in queue" value={String(payload?.summary.totalBorrowers ?? 0)} detail="Latest KYC/AML cases with live screening data" />
        <SummaryCard label="High-risk borrowers" value={String(payload?.summary.highRiskBorrowers ?? 0)} detail="Manual escalation and enhanced due diligence required" tone={RISK_STYLES.HIGH} />
        <SummaryCard label="Pending FICA docs" value={String(payload?.summary.pendingFicaDocs ?? 0)} detail="Missing or unresolved ID, address, or liveness checks" tone={{ bg: '#fef3c7', fg: '#92400e' }} />
        <SummaryCard label="Sanctions / PEP hits" value={String(payload?.summary.sanctionsHits ?? 0)} detail="Borrowers needing sanctions disposition review" tone={RISK_STYLES.HIGH} />
        <SummaryCard label="Open AML alerts" value={String(payload?.summary.openAlerts ?? 0)} detail="Alerts still awaiting case closure" tone={{ bg: '#ffedd5', fg: '#9a3412' }} />
      </div>

      <div className="rounded-xl p-5 mb-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-[0.24em] mb-2" style={{ color: 'var(--color-secondary)' }}>
              Compliance workbench
            </div>
            <p className="text-sm leading-6" style={{ color: 'var(--color-muted)' }}>
              Borrower-level FICA verification status, sanctions and PEP screening results, AML risk grading, and audit evidence are now consolidated into one queue designed for compliance review and regulatory export.
            </p>
          </div>
          <div className="text-sm" style={{ color: 'var(--color-muted)' }}>
            {payload?.generatedAt ? `Updated ${formatDate(payload.generatedAt)}` : 'Waiting for live compliance data'}
          </div>
        </div>

        <div className="flex flex-col gap-3 mt-5 xl:flex-row xl:items-center xl:justify-between">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search borrower, ID, email, phone, or risk factor"
            className="w-full xl:max-w-md rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
          />
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as ComplianceRisk[]).map((risk) => (
              <button
                key={risk}
                type="button"
                onClick={() => setRiskFilter(risk)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  background: riskFilter === risk ? 'var(--color-primary)' : 'var(--color-surface-2)',
                  color: riskFilter === risk ? '#fff' : 'var(--color-muted)',
                }}
              >
                {risk === 'ALL' ? 'All risks' : `${risk} risk`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl p-4 mb-6 text-sm" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}

      {loading && !payload ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-xl p-5 min-h-[220px] animate-pulse" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCases.map((entry) => {
            const riskTone = RISK_STYLES[entry.aml.riskRating];
            const sanctionsTone = statusStyle(entry.sanctions.sanctions.status);
            return (
              <div key={entry.borrowerId} className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h2 className="text-lg font-black">{entry.borrower.name}</h2>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: riskTone.bg, color: riskTone.fg }}>
                        {entry.aml.riskRating} AML risk
                      </span>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: sanctionsTone.bg, color: sanctionsTone.fg }}>
                        Sanctions {formatStatus(entry.sanctions.sanctions.status)}
                      </span>
                    </div>
                    <div className="text-sm" style={{ color: 'var(--color-muted)' }}>{entry.borrower.email} · {entry.borrower.phone}</div>
                    <div className="text-xs mt-1 font-mono" style={{ color: 'var(--color-muted)' }}>
                      {entry.borrower.idNumber ? `ID ${entry.borrower.idNumber}` : 'Business borrower or ID not captured'}
                    </div>
                  </div>

                  <div className="text-sm text-right" style={{ color: 'var(--color-muted)' }}>
                    <div>{entry.aml.openAlertCount} open alerts</div>
                    <div>{entry.aml.filedSarCount} SAR filed</div>
                    <div>{entry.lastUpdatedAt ? `Last event ${formatDate(entry.lastUpdatedAt)}` : 'No audit events yet'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 mt-5 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--color-muted)' }}>FICA document verification</div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <CheckTile label="ID verification" check={entry.ficaDocuments.idVerification} />
                      <CheckTile label="Proof of address" check={entry.ficaDocuments.proofOfAddress} />
                      <CheckTile label="Liveness" check={entry.ficaDocuments.liveness} />
                    </div>
                  </div>

                  <div className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--color-muted)' }}>Sanctions and AML screening</div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <ScreeningTile label="Sanctions" summary={entry.sanctions.sanctions} footer={`OFAC ${entry.sanctions.ofacStatus} · UN ${entry.sanctions.unStatus}`} />
                      <ScreeningTile label="PEP" summary={entry.sanctions.pep} footer={`Risk factors ${entry.aml.factors.length}`} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 mt-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)' }}>
                    <div className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--color-muted)' }}>AML risk factors</div>
                    <div className="flex flex-wrap gap-2">
                      {entry.aml.factors.map((factor) => (
                        <span key={factor} className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#fff', border: '1px solid var(--color-border)' }}>
                          {factor}
                        </span>
                      ))}
                    </div>
                  </div>

                  <details className="rounded-xl p-4" style={{ background: 'var(--color-surface-2)' }}>
                    <summary className="cursor-pointer font-semibold">Full compliance audit trail</summary>
                    <div className="mt-4 space-y-3">
                      {entry.auditTrail.map((event) => (
                        <div key={event.id} className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid var(--color-border)' }}>
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="font-semibold">{event.label.replace(/_/g, ' ')}</div>
                              <div className="text-xs" style={{ color: 'var(--color-muted)' }}>{event.type.replace(/_/g, ' ')} · {formatDate(event.createdAt)}</div>
                            </div>
                            <span
                              className="text-xs font-semibold px-2.5 py-1 rounded-full"
                              style={{ background: statusStyle(event.status).bg, color: statusStyle(event.status).fg }}
                            >
                              {formatStatus(event.status)}
                            </span>
                          </div>
                          {event.details ? (
                            <div className="text-sm mt-2" style={{ color: 'var(--color-muted)' }}>{event.details}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </div>
            );
          })}

          {!loading && filteredCases.length === 0 ? (
            <div className="rounded-xl p-6 text-sm" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
              No compliance cases match the current search and risk filter.
            </div>
          ) : null}
        </div>
      )}
    </OpsLayout>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: { bg: string; fg: string };
}) {
  return (
    <div className="rounded-xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="text-xs uppercase tracking-[0.18em] mb-3" style={{ color: 'var(--color-muted)' }}>{label}</div>
      <div className="text-3xl font-black mb-2">{value}</div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm leading-6" style={{ color: 'var(--color-muted)' }}>{detail}</div>
        {tone ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: tone.bg, color: tone.fg }}>Live</span> : null}
      </div>
    </div>
  );
}

function CheckTile({ label, check }: { label: string; check: CheckSummary }) {
  const tone = statusStyle(check.status);
  return (
    <div className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid var(--color-border)' }}>
      <div className="text-xs uppercase tracking-[0.16em] mb-2" style={{ color: 'var(--color-muted)' }}>{label}</div>
      <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full mb-2" style={{ background: tone.bg, color: tone.fg }}>
        {formatStatus(check.status)}
      </span>
      <div className="text-sm" style={{ color: 'var(--color-muted)' }}>{check.provider}</div>
      <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{check.outcome ?? 'No outcome captured'}</div>
      <div className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>{formatDate(check.checkedAt)}</div>
    </div>
  );
}

function ScreeningTile({
  label,
  summary,
  footer,
}: {
  label: string;
  summary: ScreeningSummary;
  footer: string;
}) {
  const tone = statusStyle(summary.status);
  return (
    <div className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid var(--color-border)' }}>
      <div className="text-xs uppercase tracking-[0.16em] mb-2" style={{ color: 'var(--color-muted)' }}>{label}</div>
      <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full mb-2" style={{ background: tone.bg, color: tone.fg }}>
        {formatStatus(summary.status)}
      </span>
      <div className="text-sm font-semibold">{summary.result}</div>
      <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>{summary.provider}</div>
      <div className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>{footer}</div>
    </div>
  );
}
