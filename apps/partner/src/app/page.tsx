'use client';

import Link from 'next/link';
import { ThemeToggle } from './_components/ThemeProvider';
import { clearSession } from '@/lib/session';

const partnerStats = [
  { label: "Loans originated", value: "342", delta: "+18 this month" },
  { label: "Portfolio value", value: "R 8.4M", delta: "+R 640k this month" },
  { label: "Approval rate", value: "71%", delta: "+3% vs last month" },
  { label: "Revenue share", value: "R 42 180", delta: "Paid to date" },
];

const recentLoans = [
  { ref: "LN-2026-00984", borrower: "T. Nkosi", amount: "R 12 000", disbursed: "2 May 2026", status: "Active", repaid: 15 },
  { ref: "LN-2026-00983", borrower: "ProBuild (Pty)", amount: "R 80 000", disbursed: "1 May 2026", status: "Active", repaid: 5 },
  { ref: "LN-2026-00977", borrower: "S. Engelbrecht", amount: "R 5 000", disbursed: "28 Apr 2026", status: "Active", repaid: 40 },
  { ref: "LN-2026-00961", borrower: "M. Khumalo", amount: "R 20 000", disbursed: "20 Apr 2026", status: "Arrears", repaid: 25 },
];

const navItems = [
  { label: "Overview",     href: "/" },
  { label: "Applications", href: "/applications" },
  { label: "Loans",        href: "/loans" },
  { label: "Products",     href: "/products" },
  { label: "Reports",      href: "/reports" },
  { label: "API Keys",     href: "/api-keys" },
  { label: "Settings",     href: "/settings" },
];

export default function PartnerHome() {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>

      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ background: "var(--color-surface)", borderRight: "1px solid var(--color-border)" }}>
        <div className="h-16 flex items-center px-5" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <span className="font-bold text-base tracking-tight">Capstack <span style={{ color: "var(--color-secondary)" }}>Partner</span></span>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {navItems.map((item, i) => (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium"
              style={{
                background: i === 0 ? "var(--color-surface-2)" : "transparent",
                color: i === 0 ? "var(--foreground)" : "var(--color-muted)",
                border: i === 0 ? "1px solid var(--color-border)" : "1px solid transparent",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 flex flex-col gap-3" style={{ borderTop: "1px solid var(--color-border)" }}>
          <ThemeToggle />
          <div className="text-xs" style={{ color: "var(--color-muted)" }}>Partner</div>
          <div className="text-sm font-semibold mt-0.5">First National Finance</div>
          <button
            onClick={() => { clearSession(); window.location.href = '/sign-in'; }}
            className="text-xs font-medium text-left"
            style={{ color: "var(--color-danger)" }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-8" style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
          <h1 className="text-lg font-bold">Portfolio overview</h1>
          <div className="flex items-center gap-3">
            <Link href="/applications/new" className="text-sm px-4 py-2 rounded-lg font-semibold" style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}>
              + Originate loan
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8">

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {partnerStats.map((s) => (
              <div key={s.label} className="rounded-xl p-5" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
                <div className="text-xs mb-2" style={{ color: "var(--color-muted)" }}>{s.label}</div>
                <div className="text-2xl font-black">{s.value}</div>
                <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>{s.delta}</div>
              </div>
            ))}
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-3 gap-6">

            {/* Loan table */}
            <div className="col-span-2 rounded-xl overflow-hidden" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
              <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
                <span className="font-bold">Recent loans</span>
                <a href="/loans" className="text-xs" style={{ color: "var(--color-secondary)" }}>View all</a>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                    {["Reference", "Borrower", "Amount", "Disbursed", "Repaid", "Status"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentLoans.map((l, i) => (
                    <tr key={l.ref} style={{ borderBottom: i < recentLoans.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                      <td className="px-5 py-3 font-mono text-xs" style={{ color: "var(--color-muted)" }}>{l.ref}</td>
                      <td className="px-5 py-3 font-medium">{l.borrower}</td>
                      <td className="px-5 py-3 font-semibold">{l.amount}</td>
                      <td className="px-5 py-3" style={{ color: "var(--color-muted)" }}>{l.disbursed}</td>
                      <td className="px-5 py-3 w-28">
                        <div className="flex items-center gap-2">
                          <progress value={l.repaid} max={100} style={{ width: 60 }} />
                          <span className="text-xs" style={{ color: "var(--color-muted)" }}>{l.repaid}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full"
                          style={{
                            background: l.status === "Active" ? "var(--badge-active-bg)" : "var(--badge-overdue-bg)",
                            color: l.status === "Active" ? "var(--badge-active-fg)" : "var(--badge-overdue-fg)",
                          }}>{l.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* API key panel */}
            <div className="rounded-xl p-6 flex flex-col gap-5" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }}>
              <div className="font-bold">API credentials</div>
              <div>
                <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>Key ID</div>
                <div className="font-mono text-xs p-2 rounded-lg break-all" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
                  pk_live_fnf_a3f9d2c1
                </div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>Secret</div>
                <div className="font-mono text-xs p-2 rounded-lg" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
                  sk_live_••••••••••••••
                </div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: "var(--color-muted)" }}>Webhook URL</div>
                <div className="font-mono text-xs p-2 rounded-lg break-all" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
                  https://fnf.co.za/webhooks/capstack
                </div>
              </div>
              <button className="mt-auto text-xs px-4 py-2 rounded-lg font-semibold" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>
                Rotate key
              </button>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

