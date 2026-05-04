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
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white font-sans">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Capstack API</h1>
        <p className="text-zinc-400 text-lg">REST API service — v1</p>
        <div className="mt-8 inline-block rounded-md bg-zinc-800 px-6 py-3 text-sm text-zinc-300">
          <code>POST /api/v1/applications</code>
        </div>
        <p className="text-zinc-600 text-sm pt-4">
          This endpoint is not intended for direct browser access.
        </p>
      </div>
    </div>
  );
}

