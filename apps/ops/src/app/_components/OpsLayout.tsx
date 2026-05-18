'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getSession, clearSession, loadServerSession, OpsSession } from '@/lib/session';
import { ThemeToggle } from './ThemeProvider';

const NAV = [
  { label: 'Dashboard',    href: '/' },
  { label: 'Applications', href: '/applications' },
  { label: 'Loans',        href: '/loans' },
  { label: 'Collections',  href: '/collections' },
  { label: 'KYC / AML',   href: '/kyc' },
  { label: 'Reports',      href: '/reports' },
  { label: 'Settings',     href: '/settings' },
];

// ─── Simple arithmetic calculator ─────────────────────────────────────────────

function SimpleCalculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay]   = useState('0');
  const [prev,    setPrev]      = useState<number | null>(null);
  const [op,      setOp]        = useState<string | null>(null);
  const [fresh,   setFresh]     = useState(false); // next digit replaces display

  function pressDigit(d: string) {
    if (fresh) { setDisplay(d); setFresh(false); return; }
    setDisplay(display === '0' && d !== '.' ? d : display.includes('.') && d === '.' ? display : display + d);
  }

  function pressOp(o: string) {
    const cur = parseFloat(display);
    if (prev !== null && op && !fresh) {
      const result = calc(prev, cur, op);
      setDisplay(String(result));
      setPrev(result);
    } else {
      setPrev(cur);
    }
    setOp(o);
    setFresh(true);
  }

  function calc(a: number, b: number, o: string) {
    if (o === '+') return a + b;
    if (o === '−') return a - b;
    if (o === '×') return a * b;
    if (o === '÷') return b === 0 ? 0 : a / b;
    return b;
  }

  function pressEquals() {
    if (prev === null || !op) return;
    const result = calc(prev, parseFloat(display), op);
    const str    = parseFloat(result.toFixed(10)).toString();
    setDisplay(str);
    setPrev(null);
    setOp(null);
    setFresh(true);
  }

  function pressClear() {
    setDisplay('0'); setPrev(null); setOp(null); setFresh(false);
  }

  const btn = (label: string, onClick: () => void, accent = false) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        padding: '10px 0', borderRadius: 8, fontSize: 15, fontWeight: 600,
        cursor: 'pointer', border: '1px solid var(--color-border)',
        background: accent ? 'var(--color-secondary)' : 'var(--color-surface-2)',
        color: accent ? '#fff' : 'var(--foreground)',
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 14, padding: 20, width: 260,
        boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Calculator</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--color-muted)', lineHeight: 1 }}>×</button>
        </div>
        {/* Display */}
        <div style={{
          background: 'var(--color-surface-2)', border: '1px solid var(--color-border)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 12,
          textAlign: 'right', fontSize: 22, fontWeight: 700,
          fontVariantNumeric: 'tabular-nums', wordBreak: 'break-all', minHeight: 48,
          color: 'var(--foreground)',
        }}>
          {op && prev !== null && <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block', marginBottom: 2 }}>{prev} {op}</span>}
          {display}
        </div>
        {/* Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {btn('C',  pressClear,      false)}
          {btn('+/−', () => setDisplay(d => String(parseFloat(d) * -1)), false)}
          {btn('%',  () => setDisplay(d => String(parseFloat(d) / 100)), false)}
          {btn('÷',  () => pressOp('÷'), true)}
          {btn('7',  () => pressDigit('7'))}
          {btn('8',  () => pressDigit('8'))}
          {btn('9',  () => pressDigit('9'))}
          {btn('×',  () => pressOp('×'), true)}
          {btn('4',  () => pressDigit('4'))}
          {btn('5',  () => pressDigit('5'))}
          {btn('6',  () => pressDigit('6'))}
          {btn('−',  () => pressOp('−'), true)}
          {btn('1',  () => pressDigit('1'))}
          {btn('2',  () => pressDigit('2'))}
          {btn('3',  () => pressDigit('3'))}
          {btn('+',  () => pressOp('+'), true)}
          <button
            onClick={() => pressDigit('0')}
            style={{
              gridColumn: 'span 2', padding: '10px 0', borderRadius: 8, fontSize: 15,
              fontWeight: 600, cursor: 'pointer', border: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)', color: 'var(--foreground)',
            }}
          >0</button>
          {btn('.',  () => pressDigit('.'))}
          {btn('=',  pressEquals, true)}
        </div>
      </div>
    </div>
  );
}

export default function OpsLayout({
  children,
  title,
  action,
}: {
  children: React.ReactNode;
  title:    string;
  action?:  React.ReactNode;
}) {
  const router   = useRouter();
  const pathname = usePathname();
  const [session,  setSessionState]  = useState<OpsSession | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function hydrateSession() {
      const cached = getSession();
      if (cached && active) {
        setSessionState(cached);
      }

      const serverSession = await loadServerSession();
      if (!active) return;

      if (!serverSession) {
        await clearSession();
        router.replace('/sign-in?reason=session_expired');
        return;
      }

      setSessionState(serverSession);
    }

    hydrateSession();

    return () => {
      active = false;
    };
  }, [router]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-sm" style={{ color: 'var(--color-muted)' }}>Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      {calcOpen && <SimpleCalculator onClose={() => setCalcOpen(false)} />}

      {/* Sidebar */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col"
        style={{ background: 'var(--color-surface)', borderRight: '1px solid var(--color-border)' }}
      >
        <div className="h-16 flex items-center px-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <span className="font-bold text-base tracking-tight">
            Capstack <span style={{ color: 'var(--color-secondary)' }}>Ops</span>
          </span>
        </div>

        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV.map(item => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: active ? 'var(--color-surface-2)' : 'transparent',
                  color:      active ? 'var(--foreground)'       : 'var(--color-muted)',
                  border:     active ? '1px solid var(--color-border)' : '1px solid transparent',
                }}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--color-border)', margin: '8px 4px' }} />

          {/* Calculator */}
          <button
            onClick={() => setCalcOpen(true)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full text-left"
            style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--color-muted)', cursor: 'pointer' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <rect x="7" y="5" width="10" height="4" rx="1" />
              <circle cx="8"  cy="13"   r="0.9" fill="currentColor" stroke="none" />
              <circle cx="12" cy="13"   r="0.9" fill="currentColor" stroke="none" />
              <circle cx="16" cy="13"   r="0.9" fill="currentColor" stroke="none" />
              <circle cx="8"  cy="16.5" r="0.9" fill="currentColor" stroke="none" />
              <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
              <circle cx="16" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
              <rect x="6.5" y="19" width="4" height="1.5" rx="0.75" fill="currentColor" stroke="none" />
              <circle cx="16" cy="19.75" r="0.9" fill="currentColor" stroke="none" />
            </svg>
            Calculator
          </button>

          {/* PDF Reports */}
          <Link
            href="/downloads"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--color-muted)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="13" y2="17" />
            </svg>
            PDF Reports
          </Link>
        </nav>

        <div className="p-4 flex flex-col gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <ThemeToggle />
          <div className="text-xs" style={{ color: 'var(--color-muted)' }}>Signed in as</div>
          <div className="text-sm font-semibold mt-0.5">{session.name}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{session.role}</div>
          <button
            onClick={async () => { await clearSession(); router.push('/sign-in'); }}
            className="text-xs mt-1 font-medium text-left"
            style={{ color: 'var(--color-danger)' }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header
          className="h-16 flex items-center justify-between px-8"
          style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
        >
          <h1 className="text-lg font-bold">{title}</h1>
          {action && <div className="flex items-center gap-3">{action}</div>}
        </header>

        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </div>
  );
}
