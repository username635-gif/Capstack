import HeroSection from '@/components/HeroSection';

export default function BorrowerHome() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)", color: "var(--foreground)" }}>

      <HeroSection />

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

      {/* Demo loan card */}
      <section className="max-w-6xl mx-auto px-6 pb-20 w-full">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Demo loan preview</h2>
            <p className="text-sm mt-2" style={{ color: 'var(--color-muted)' }}>
              Example borrower data shown to preview the dashboard experience before sign-in.
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full w-fit" style={{ background: 'var(--color-surface-2)', color: 'var(--color-secondary)', border: '1px solid var(--color-border)' }}>
            Demo example
          </span>
        </div>
        <div className="rounded-xl p-6" style={{ background: "var(--color-surface)", border: "0.5px solid var(--color-border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm mb-1" style={{ color: "var(--color-muted)" }}>Example personal loan · REF-DEMO-00812</div>
              <div className="text-3xl font-black">R 15 000</div>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "var(--badge-active-bg)", color: "var(--badge-active-fg)" }}>Demo active loan</span>
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
          <span>NCR Registered · FSP registration pending</span>
        </div>
      </footer>

    </div>
  );
}

