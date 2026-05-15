'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ThemeToggle } from './_components/ThemeProvider';
import { LoanCalculator, CalculatorIcon } from './_components/LoanCalculator';

export default function BorrowerHome() {
  const [calcOpen, setCalcOpen] = useState(false);
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)", color: "var(--foreground)" }}>

      <LoanCalculator open={calcOpen} onClose={() => setCalcOpen(false)} />

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight">Capstack</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {/* Calculator icon — thin white outline, no fill */}
            <button
              onClick={() => setCalcOpen(true)}
              aria-label="Open loan calculator"
              title="Loan Calculator"
              style={{
                background:   'transparent',
                border:       '1px solid rgba(255,255,255,0.25)',
                borderRadius: 8,
                padding:      '5px 7px',
                cursor:       'pointer',
                display:      'flex',
                alignItems:   'center',
                lineHeight:   1,
              }}
            >
              <CalculatorIcon size={18} color="var(--foreground)" strokeWidth={1.4} />
            </button>
            <Link href="/sign-in" className="text-sm" style={{ color: "var(--color-muted)" }}>Sign in</Link>
            <Link
              href="/apply"
              className="text-sm font-semibold px-4 py-2 rounded-lg"
              style={{ background: "var(--color-primary)", color: "var(--color-primary-fg)" }}
            >
              Apply now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 gap-6">
        <div className="text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full" style={{ background: "var(--color-surface-2)", color: "var(--color-secondary)", border: "1px solid var(--color-border)" }}>
          Fast · Transparent · Fair
        </div>
        <h1 className="text-5xl font-black tracking-tight max-w-2xl leading-tight">
          Get funded <span style={{ color: "var(--color-secondary)" }}>in 24 hours</span>
        </h1>
        <p className="text-lg max-w-lg" style={{ color: "var(--color-muted)" }}>
          Apply for a personal or business loan in minutes. No hidden fees, no surprises — just clear terms and fast decisions.
        </p>
        <div className="flex gap-3 mt-2">
          <a href="/apply" className="px-6 py-3 rounded-lg font-semibold text-sm" style={{ background: "var(--color-primary)", color: "#fff" }}>
            Apply for a loan
          </a>
          <a href="/dashboard" className="px-6 py-3 rounded-lg font-semibold text-sm" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--foreground)" }}>
            Check my application
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ borderTop: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-3 gap-6 text-center">
          {[
            { label: "Avg. approval time", value: "4 hrs" },
            { label: "Loans disbursed", value: "R 42M+" },
            { label: "Borrowers served", value: "8 200+" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-black">{s.value}</div>
              <div className="text-sm mt-1" style={{ color: "var(--color-muted)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20 w-full">
        <h2 className="text-2xl font-bold mb-10 text-center">How it works</h2>
        <div className="grid grid-cols-3 gap-6">
          {[
            { step: "01", title: "Apply online", desc: "Fill in your details and upload your documents in under 5 minutes." },
            { step: "02", title: "Get a decision", desc: "Our system reviews your application and gives you a real-time outcome." },
            { step: "03", title: "Receive funds", desc: "Approved funds are paid directly into your bank account within 24 hours." },
          ].map((item) => (
            <div key={item.step} className="rounded-xl p-6" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <div className="text-xs font-bold mb-3" style={{ color: "var(--color-secondary)" }}>{item.step}</div>
              <div className="font-bold text-lg mb-2">{item.title}</div>
              <div className="text-sm" style={{ color: "var(--color-muted)" }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Active loan card (logged-in state preview) */}
      <section className="max-w-6xl mx-auto px-6 pb-20 w-full">
        <h2 className="text-2xl font-bold mb-6">My loan</h2>
        <div className="rounded-xl p-6" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm mb-1" style={{ color: "var(--color-muted)" }}>Personal loan · REF-2024-00812</div>
              <div className="text-3xl font-black">R 15 000</div>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "var(--badge-active-bg)", color: "var(--badge-active-fg)" }}>Active</span>
          </div>
          <div className="mb-2 flex justify-between text-sm" style={{ color: "var(--color-muted)" }}>
            <span>Repaid: R 6 000</span>
            <span>Remaining: R 9 000</span>
          </div>
          <progress value={40} max={100} className="w-full" />
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <div style={{ color: "var(--color-muted)" }}>Next payment</div>
              <div className="font-semibold">R 1 250 · 1 Jun</div>
            </div>
            <div>
              <div style={{ color: "var(--color-muted)" }}>Interest rate</div>
              <div className="font-semibold">24% APR</div>
            </div>
            <div>
              <div style={{ color: "var(--color-muted)" }}>Term</div>
              <div className="font-semibold">12 months</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className="max-w-6xl mx-auto px-6 py-6 flex justify-between items-center text-xs" style={{ color: "var(--color-muted)" }}>
          <span>© 2026 Capstack Financial Services</span>
          <span>NCR Registered · FSP 12345</span>
        </div>
      </footer>

    </div>
  );
}

