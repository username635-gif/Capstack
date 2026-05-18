/**
 * API service landing page.
 *
 * This Next.js app is purely a REST API server — it has no user-facing UI.
 * All routes live under /api/v1/.
 *
 * This root page is only shown if someone browses to the API host directly.
 * It serves as a health/info page so it is clear what service is running.
 */
export default function ApiHome() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 font-sans"
      style={{ background: 'var(--background)', color: 'var(--foreground)' }}
    >
      <div className="text-center space-y-4 rounded-3xl px-10 py-12" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h1 className="text-3xl font-bold tracking-tight">Capstack API</h1>
        <p className="text-lg" style={{ color: 'var(--color-muted)' }}>REST API service — v1</p>
        <div className="mt-8 inline-block rounded-md px-6 py-3 text-sm" style={{ background: 'var(--color-surface-2)', color: 'var(--foreground)', border: '1px solid var(--color-border)' }}>
          <code>POST /api/v1/applications</code>
        </div>
        <p className="text-sm pt-4" style={{ color: 'var(--color-muted)' }}>
          This endpoint is not intended for direct browser access.
        </p>
      </div>
    </div>
  );
}

