const stats = [
  { label: "Active loans", value: "1 284", delta: "+12 today" },
  { label: "Pending applications", value: "47", delta: "8 urgent" },
  { label: "Total disbursed", value: "R 42.1M", delta: "+R 320k this week" },
  { label: "Delinquency rate", value: "3.2%", delta: "-0.4% vs last month" },
];

const applications = [
  { ref: "APP-2026-04891", borrower: "Sipho Dlamini", amount: "R 25 000", product: "Personal", status: "Pending review", risk: "B" },
  { ref: "APP-2026-04890", borrower: "Acme Trading (Pty)", amount: "R 120 000", product: "Business", status: "Awaiting docs", risk: "C" },
  { ref: "APP-2026-04889", borrower: "Naledi Mokoena", amount: "R 8 000", product: "Salary advance", status: "Approved", risk: "A" },
  { ref: "APP-2026-04888", borrower: "James van der Merwe", amount: "R 50 000", product: "Term loan", status: "Declined", risk: "D" },
  { ref: "APP-2026-04887", borrower: "Fatima Cassim", amount: "R 15 000", product: "BNPL", status: "Pending review", risk: "B" },
];

const statusColor: Record<string, string> = {
  "Pending review": "var(--badge-pending-bg)",
  "Awaiting docs": "var(--badge-awaiting-bg)",
  "Approved": "var(--badge-approved-bg)",
  "Declined": "var(--badge-declined-bg)",
};
const statusFg: Record<string, string> = {
  "Pending review": "var(--badge-pending-fg)",
  "Awaiting docs": "var(--badge-awaiting-fg)",
  "Approved": "var(--badge-approved-fg)",
  "Declined": "var(--badge-declined-fg)",
};

const navItems = [
  { label: "Dashboard",    href: "/" },
  { label: "Applications", href: "/applications" },
  { label: "Loans",        href: "/loans" },
  { label: "Collections",  href: "/collections" },
  { label: "KYC / AML",   href: "/kyc" },
  { label: "Reports",      href: "/reports" },
  { label: "Settings",     href: "/settings" },
];

export default function OpsHome() {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>

      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ background: "var(--color-surface)", borderRight: "1px solid var(--color-border)" }}>
        <div className="h-16 flex items-center px-5" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <span className="font-bold text-base tracking-tight">Capstack <span style={{ color: "var(--color-secondary)" }}>Ops</span></span>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {navItems.map((item, i) => (
            <a
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: i === 0 ? "var(--color-surface-2)" : "transparent",
                color: i === 0 ? "var(--foreground)" : "var(--color-muted)",
                border: i === 0 ? "1px solid var(--color-border)" : "1px solid transparent",
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="p-4" style={{ borderTop: "1px solid var(--color-border)" }}>
          <div className="text-xs" style={{ color: "var(--color-muted)" }}>Logged in as</div>
          <div className="text-sm font-semibold mt-0.5">Admin User</div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-8" style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
          <h1 className="text-lg font-bold">Dashboard</h1>
          <div className="flex items-center gap-3">
            <a href="/applications/new" className="text-sm px-4 py-2 rounded-lg font-semibold" style={{ background: "var(--color-primary)", color: "#fff" }}>
              + New application
            </a>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8">

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl p-5" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
                <div className="text-xs mb-2" style={{ color: "var(--color-muted)" }}>{s.label}</div>
                <div className="text-2xl font-black">{s.value}</div>
                <div className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>{s.delta}</div>
              </div>
            ))}
          </div>

          {/* Application queue */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <span className="font-bold">Application queue</span>
              <a href="/applications" className="text-xs" style={{ color: "var(--color-secondary)" }}>View all</a>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  {["Reference", "Borrower", "Amount", "Product", "Risk", "Status", "Action"].map((h) => (
                    <th key={h} className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {applications.map((a, i) => (
                  <tr key={a.ref} style={{ borderBottom: i < applications.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                    <td className="px-6 py-4 font-mono text-xs" style={{ color: "var(--color-muted)" }}>{a.ref}</td>
                    <td className="px-6 py-4 font-medium">{a.borrower}</td>
                    <td className="px-6 py-4 font-semibold">{a.amount}</td>
                    <td className="px-6 py-4" style={{ color: "var(--color-muted)" }}>{a.product}</td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-xs px-2 py-0.5 rounded" style={{ background: "var(--color-surface-2)", color: "var(--color-secondary)" }}>{a.risk}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: statusColor[a.status], color: statusFg[a.status] }}>{a.status}</span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-xs px-3 py-1 rounded-lg font-medium" style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border)" }}>Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </main>
      </div>
    </div>
  );
}

