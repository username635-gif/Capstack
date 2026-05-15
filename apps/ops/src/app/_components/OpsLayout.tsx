'use client';

/**
 * OpsLayout — shared sidebar + header wrapper for all authenticated ops pages.
 *
 * Usage:
 *   <OpsLayout title="Applications">
 *     <YourPageContent />
 *   </OpsLayout>
 *
 * Handles:
 *   - Auth check: redirects to /sign-in if localStorage session is missing
 *   - Sidebar navigation with active-state highlighting
 *   - Sign-out button
 */

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getSession, clearSession, OpsSession } from '@/lib/session';
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
  const [session, setSession] = useState<OpsSession | null>(null);

  useEffect(() => {
    const s = getSession();
    if (!s) { router.replace('/sign-in'); return; }
    setSession(s);
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
        </nav>

        <div className="p-4 flex flex-col gap-3" style={{ borderTop: '1px solid var(--color-border)' }}>
          <ThemeToggle />
          <div className="text-xs" style={{ color: 'var(--color-muted)' }}>Signed in as</div>
          <div className="text-sm font-semibold mt-0.5">{session.name}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{session.role}</div>
          <button
            onClick={() => { clearSession(); router.push('/sign-in'); }}
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
