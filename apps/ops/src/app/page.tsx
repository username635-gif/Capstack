/**
 * Operations dashboard home page.
 *
 * This portal is for internal Capstack staff (credit analysts, compliance officers,
 * collections teams, and administrators).
 *
 * Planned features:
 *   - Application review queue (approve / decline / refer)
 *   - KYC / AML alert management
 *   - Loan portfolio overview and collections dashboard
 *   - Audit log viewer
 *   - User and lender management
 *
 * Access should be gated behind role-based authentication.
 * Only staff with the OPERATOR or ADMIN role should reach this portal.
 */
export default function OpsHome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 font-sans">
      <div className="text-center space-y-4 max-w-lg px-8">
        <div className="text-5xl">&#128202;</div>
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Capstack Ops Dashboard
        </h1>
        <p className="text-zinc-400 text-lg">
          Internal operations, credit review, and compliance management.
        </p>
        <p className="text-zinc-600 text-sm pt-4 border-t border-zinc-800">
          Coming soon — this page is a placeholder.
        </p>
      </div>
    </div>
  );
}

