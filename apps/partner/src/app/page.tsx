/**
 * Partner portal home page.
 *
 * This portal is for lending partners (financial institutions, credit providers)
 * who originate loans and manage their borrower portfolios through Capstack.
 *
 * Planned features:
 *   - Portfolio dashboard (active loans, arrears, repayment rates)
 *   - Loan product configuration
 *   - API credential management
 *   - Disbursement and settlement reports
 *   - Borrower search and application management
 *
 * Access is scoped to a specific Lender record in the database.
 * Multi-tenancy is enforced at the API layer via the lenderId claim in the JWT.
 */
export default function PartnerHome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white font-sans">
      <div className="text-center space-y-4 max-w-lg px-8">
        <div className="text-5xl">&#129309;</div>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
          Capstack Partner Portal
        </h1>
        <p className="text-zinc-500 text-lg">
          Manage your lending portfolio, products, and borrower applications.
        </p>
        <p className="text-zinc-400 text-sm pt-4 border-t border-zinc-100">
          Coming soon — this page is a placeholder.
        </p>
      </div>
    </div>
  );
}

