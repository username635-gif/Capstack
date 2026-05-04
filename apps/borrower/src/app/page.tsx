/**
 * Borrower portal home page.
 *
 * This is the entry point for loan applicants.
 * Replace this placeholder with the actual borrower onboarding flow:
 *   1. Sign up / log in (Clerk or NextAuth)
 *   2. Submit loan application (calls POST /api/v1/applications)
 *   3. Track application status
 *   4. View repayment schedule and make payments
 */
export default function BorrowerHome() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white font-sans">
      <div className="text-center space-y-4 max-w-lg px-8">
        <div className="text-5xl">&#128176;</div>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
          Capstack Borrower Portal
        </h1>
        <p className="text-zinc-500 text-lg">
          Apply for a loan, track your application, and manage repayments.
        </p>
        <p className="text-zinc-400 text-sm pt-4 border-t border-zinc-100">
          Coming soon — this page is a placeholder.
        </p>
      </div>
    </div>
  );
}

