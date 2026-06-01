'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { getSession, clearSession, PartnerSession } from '@/lib/session';
import { ThemeToggle } from './ThemeProvider';

const NAV = [
  { label: 'Overview',     href: '/' },
  { label: 'Applications', href: '/applications' },
  { label: 'Loans',        href: '/loans' },
  { label: 'Products',     href: '/products' },
  { label: 'Reports',      href: '/reports' },
  { label: 'API Keys',     href: '/api-keys' },
  { label: 'Settings',     href: '/settings' },
];

export default function PartnerLayout({
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
  const [session, setSession] = useState<PartnerSession | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  const sidebarContent = (
    <>
      <div className="h-16 flex items-center px-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="font-bold text-base tracking-tight">
          Capstack <span style={{ color: 'var(--color-secondary)' }}>Partner</span>
        </span>
      </div>

      <nav className="flex flex-col gap-1 p-3 flex-1">
        {NAV.map(item => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
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
        <div className="text-sm font-semibold">{session.name}</div>
        <button
          onClick={() => { clearSession(); router.push('/sign-in'); }}
          className="text-xs mt-1 font-medium text-left"
          style={{ color: 'var(--color-danger)' }}
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div style={{ background: 'var(--background)', color: 'var(--foreground)' }}>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col"
        style={{
          position: 'fixed', top: 0, left: 0,
          height: '100vh', width: '200px', zIndex: 40,
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile topbar */}
      <div
        className="flex md:hidden h-16 items-center px-5"
        style={{
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          position: 'sticky', top: 0, zIndex: 30,
        }}
      >
        <span className="font-bold text-base tracking-tight">
          Capstack <span style={{ color: 'var(--color-secondary)' }}>Partner</span>
        </span>
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          style={{
            marginLeft: 'auto', background: 'transparent',
            border: '1px solid transparent', cursor: 'pointer',
            color: 'var(--foreground)', padding: 6, borderRadius: 8,
          }}
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            style={{
              position: 'fixed', top: 0, left: 0,
              height: '100vh', width: 280, zIndex: 50,
              background: 'var(--color-surface)',
              borderRight: '1px solid var(--color-border)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="md:ml-[200px]" style={{ background: 'var(--background)', color: 'var(--foreground)', minHeight: '100vh' }}>
        <header
          className="h-16 hidden md:flex items-center justify-between px-8"
          style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
        >
          <h1 className="text-lg font-bold">{title}</h1>
          {action && <div className="flex items-center gap-3">{action}</div>}
        </header>

        <main className="flex-1 p-8 overflow-x-auto">{children}</main>
      </div>
    </div>
  );
}