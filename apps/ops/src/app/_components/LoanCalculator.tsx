'use client';

/**
 * Loan Calculator Modal — Ops edition
 *
 * Used by credit officers to check affordability and estimate payments
 * during application review. Same math as the borrower-facing calculator.
 *
 * CALCULATIONS:
 *   Monthly installment: equal-installment amortization formula
 *     M = P × [ r(1+r)^n ] / [ (1+r)^n − 1 ]
 *     where r = monthly rate, n = months
 *
 *   Affordability: NCA-aligned — installment should not exceed 30% of
 *   net disposable income.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

interface Props {
  open:    boolean;
  onClose: () => void;
}

// ─── Math ─────────────────────────────────────────────────────────────────────

function calcMonthly(principal: number, annualRatePct: number, months: number): number {
  if (months <= 0 || principal <= 0) return 0;
  if (annualRatePct === 0) return principal / months;
  const r = annualRatePct / 100 / 12;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

type Verdict = 'AFFORDABLE' | 'TIGHT' | 'OVER_LIMIT' | 'UNKNOWN';

function affordabilityVerdict(
  monthly: number,
  income: number,
  expenses: number,
): Verdict {
  if (income <= 0) return 'UNKNOWN';
  const disposable = income - expenses;
  if (disposable <= 0) return 'OVER_LIMIT';
  const ratio = monthly / disposable;
  if (ratio <= 0.30) return 'AFFORDABLE';
  if (ratio <= 0.45) return 'TIGHT';
  return 'OVER_LIMIT';
}

const VERDICT_META = {
  AFFORDABLE: { label: 'Affordable',      color: '#059669', bg: '#ECFDF5', icon: '✓' },
  TIGHT:      { label: 'Tight — caution', color: '#B45309', bg: '#FEFCE8', icon: '⚠' },
  OVER_LIMIT: { label: 'Over limit',       color: '#DC2626', bg: '#FEF2F2', icon: '✕' },
  UNKNOWN:    { label: 'Enter income',     color: '#64748B', bg: '#F1F5F9', icon: '?' },
};

const fmt = (n: number) =>
  'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Component ────────────────────────────────────────────────────────────────

export function LoanCalculator({ open, onClose }: Props) {
  const [amount,   setAmount]   = useState(25000);
  const [months,   setMonths]   = useState(24);
  const [ratePct,  setRatePct]  = useState(18);
  const [income,   setIncome]   = useState(0);
  const [expenses, setExpenses] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const monthly        = calcMonthly(amount, ratePct, months);
  const totalRepayable = monthly * months;
  const totalInterest  = totalRepayable - amount;
  const verdict        = affordabilityVerdict(monthly, income, expenses);
  const verdictMeta    = VERDICT_META[verdict];

  const SliderInput = useCallback(({
    label, value, onChange, min, max, step = 1, prefix = '', suffix = '',
  }: {
    label: string; value: number; onChange: (v: number) => void;
    min: number; max: number; step?: number; prefix?: string; suffix?: string;
  }) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)' }}>{label}</label>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
          {prefix}{value.toLocaleString('en-ZA')}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--color-secondary)', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{prefix}{min.toLocaleString()}{suffix}</span>
        <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{prefix}{max.toLocaleString()}{suffix}</span>
      </div>
    </div>
  ), []);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={e => e.target === overlayRef.current && onClose()}
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(15, 43, 61, 0.5)',
        backdropFilter: 'blur(3px)',
        zIndex:         1000,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        24,
      }}
    >
      <div
        style={{
          background:   'var(--color-surface)',
          border:       '1px solid var(--color-border)',
          borderRadius: 16,
          width:        '100%',
          maxWidth:     480,
          maxHeight:    '90vh',
          overflowY:    'auto',
          padding:      28,
          boxShadow:    '0 24px 64px rgba(0,0,0,0.18)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalculatorIcon size={20} color="var(--color-secondary)" />
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>Loan Calculator</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--color-muted)', lineHeight: 1 }}
            aria-label="Close calculator"
          >
            ×
          </button>
        </div>

        {/* Sliders */}
        <SliderInput label="Loan amount"   value={amount}  onChange={setAmount}  min={1000}  max={500000} step={1000} prefix="R " />
        <SliderInput label="Term"          value={months}  onChange={setMonths}  min={1}     max={84}                 suffix=" months" />
        <SliderInput label="Interest rate" value={ratePct} onChange={setRatePct} min={5}     max={30}     step={0.5}  suffix="% p.a." />

        {/* Results card */}
        <div style={{
          background:   'var(--color-surface-2)',
          border:       '1px solid var(--color-border)',
          borderRadius: 12,
          padding:      18,
          marginBottom: 16,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 4 }}>ESTIMATED MONTHLY PAYMENT</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--color-secondary)' }}>{fmt(monthly)}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['Total repayable', fmt(totalRepayable)],
              ['Total interest',  fmt(totalInterest)],
              ['Principal',       fmt(amount)],
              ['Effective APR',   `${ratePct}%`],
            ].map(([label, val]) => (
              <div key={label} style={{ background: 'var(--color-surface)', borderRadius: 8, padding: 10, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--color-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Affordability */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', marginBottom: 10 }}>
            Affordability Check
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 4 }}>
              Borrower monthly net income (after tax)
            </label>
            <input
              type="number"
              value={income || ''}
              onChange={e => setIncome(Number(e.target.value))}
              placeholder="e.g. 25000"
              style={{
                width: '100%', boxSizing: 'border-box' as const,
                padding: '8px 12px', borderRadius: 8, fontSize: 13,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-2)',
                color: 'var(--foreground)', outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'var(--color-muted)', display: 'block', marginBottom: 4 }}>
              Fixed monthly expenses (rent, food, etc.)
            </label>
            <input
              type="number"
              value={expenses || ''}
              onChange={e => setExpenses(Number(e.target.value))}
              placeholder="e.g. 8000"
              style={{
                width: '100%', boxSizing: 'border-box' as const,
                padding: '8px 12px', borderRadius: 8, fontSize: 13,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-2)',
                color: 'var(--foreground)', outline: 'none',
              }}
            />
          </div>

          {/* Verdict */}
          <div style={{
            background:   verdictMeta.bg,
            borderRadius: 10,
            padding:      '12px 14px',
            display:      'flex',
            alignItems:   'center',
            gap:          10,
          }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: verdictMeta.color }}>{verdictMeta.icon}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: verdictMeta.color }}>{verdictMeta.label}</div>
              {verdict !== 'UNKNOWN' && (
                <div style={{ fontSize: 11, color: verdictMeta.color, marginTop: 2 }}>
                  {verdict === 'AFFORDABLE'
                    ? `Installment is ${((monthly / (income - expenses)) * 100).toFixed(0)}% of disposable income (below 30% NCA guideline)`
                    : verdict === 'TIGHT'
                      ? `Installment is ${((monthly / (income - expenses)) * 100).toFixed(0)}% of disposable income (30–45% — document justification)`
                      : `Installment exceeds 45% of disposable income — NCA s.81 reckless lending risk`}
                </div>
              )}
            </div>
          </div>
        </div>

        <p style={{ fontSize: 10, color: 'var(--color-muted)', textAlign: 'center', marginTop: 8 }}>
          Estimates only. Final terms are set by the credit policy engine.
          Affordability thresholds per NCA s.81.
        </p>
      </div>
    </div>
  );
}

// ─── Calculator SVG icon (thin lines, no fill) ────────────────────────────────

export function CalculatorIcon({
  size = 22,
  color = 'currentColor',
  strokeWidth = 1.5,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Calculator"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <rect x="7" y="5" width="10" height="4" rx="1" />
      <circle cx="8"  cy="13"   r="0.8" fill={color} stroke="none" />
      <circle cx="12" cy="13"   r="0.8" fill={color} stroke="none" />
      <circle cx="16" cy="13"   r="0.8" fill={color} stroke="none" />
      <circle cx="8"  cy="16.5" r="0.8" fill={color} stroke="none" />
      <circle cx="12" cy="16.5" r="0.8" fill={color} stroke="none" />
      <circle cx="16" cy="16.5" r="0.8" fill={color} stroke="none" />
      <rect x="6.5" y="19" width="4" height="1.5" rx="0.75" fill={color} stroke="none" />
      <circle cx="16" cy="19.75" r="0.8" fill={color} stroke="none" />
    </svg>
  );
}

// ─── Document / PDF icon (thin lines, no fill) ────────────────────────────────

export function DocumentIcon({
  size = 22,
  color = 'currentColor',
  strokeWidth = 1.5,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="Download PDF"
    >
      <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}
