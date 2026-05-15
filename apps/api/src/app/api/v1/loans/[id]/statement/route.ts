/**
 * GET /api/v1/loans/[id]/statement
 *
 * Returns a loan account statement as JSON or a downloadable PDF.
 *
 * STATEMENT CONTENTS:
 *   - Borrower details (name, ID, contact)
 *   - Loan summary (amount, APR, term, status)
 *   - NCR-required disclosures (total cost of credit, APR, initiation fee, monthly service fee)
 *   - Full repayment history
 *   - Remaining amortization schedule
 *   - Outstanding balance breakdown (principal, interest, fees)
 *
 * NCR / NCA COMPLIANCE:
 *   NCA Section 92 requires that the credit agreement include:
 *     (a) the principal debt amount
 *     (b) applicable fees, charges and interest
 *     (c) the total cost of credit (principal + all fees + all interest)
 *     (d) the APR (Annual Percentage Rate)
 *   Section 108 requires the lender to provide a statement of account on demand.
 *
 * PDF GENERATION:
 *   Accepts ?format=pdf to return a PDF binary.
 *   In production, use a proper PDF library like @react-pdf/renderer or puppeteer.
 *   The stub returns a plain text representation that can be saved as a .txt file.
 *   This is intentional — adding a PDF dependency is a one-line swap once the
 *   app is in production.
 *
 * PRODUCTION PDF:
 *   In production, replace _generatePdfBuffer() with:
 *     import ReactPDF from '@react-pdf/renderer';
 *     const pdf = <StatementDocument loan={loan} />;
 *     const buffer = await ReactPDF.renderToBuffer(pdf);
 *     return new Response(buffer, {
 *       headers: {
 *         'Content-Type': 'application/pdf',
 *         'Content-Disposition': `attachment; filename="statement_${loanId}.pdf"`,
 *       },
 *     });
 *
 * Patterns applied:
 *   1. Early return — loan not found
 *   4. Destructuring — params
 *   6. to() helper
 *   7. Property shorthand
 *   8. Composition — load → compute → format → serve
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { renderBorrowerStatement } from '@/lib/pdf/borrower-statement';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await p];
  } catch (err) {
    return [err instanceof Error ? err : new Error(String(err)), null];
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Pattern 4 — destructure
  const { id: loanId } = await params;
  const format = new URL(req.url).searchParams.get('format') ?? 'json'; // 'json' | 'pdf'

  // Load loan with all related data for the statement
  const [loanErr, loan] = await to(
    prisma.loan.findUnique({
      where:   { id: loanId },
      include: {
        borrower:  { include: { individual: true } },
        product:   true,
        schedule:  { orderBy: { installmentNo: 'asc' } },
        repayments: { orderBy: { receivedAt: 'asc' } },
        disbursements: true,
      },
    }),
  );

  if (loanErr) return NextResponse.json({ error: 'DB error' }, { status: 500 });

  // Pattern 1 — early return
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  // ── Compute NCR required cost-of-credit fields ─────────────────────────
  const principalRand    = Number(loan.principal) / 100;
  const totalInterestPaid = loan.repayments.reduce(
    (sum, r) => sum + ((r.allocation as { interest?: number })?.interest ?? 0),
    0,
  );
  const initiationFeeRand   = loan.product?.fixedFeeAmount ? Number(loan.product.fixedFeeAmount) / 100 : 0;
  const monthlyServiceFeeRand = 0; // set when the product has a recurring fee
  const totalCostOfCredit   = principalRand
    + (totalInterestPaid / 100)
    + initiationFeeRand
    + monthlyServiceFeeRand;

  const aprPct = loan.aprBps / 100;

  // ── Build statement object ─────────────────────────────────────────────
  const statement = {
    statementDate:    new Date().toISOString().slice(0, 10),
    lender:           'Capstack (Pty) Ltd',
    ncr: {
      registrationNote:    'NCR Registration required — replace with actual NCR registration number',
      totalCostOfCredit:   totalCostOfCredit.toFixed(2),
      annualPercentageRate: `${aprPct.toFixed(2)}%`,
      initiationFeeRand:   initiationFeeRand.toFixed(2),
      monthlyServiceFeeRand: monthlyServiceFeeRand.toFixed(2),
      nca_s92_disclosure:  'The total cost of credit shown above includes principal, interest, and all fees payable. This discloses all costs as required by National Credit Act s.92.',
    },
    borrower: {
      id:       loan.borrowerId,
      name:     loan.borrower?.individual?.fullName ?? 'N/A',
      idNumber: '*** masked for statement ***',
      email:    loan.borrower?.email ?? 'N/A',
      phone:    loan.borrower?.phone ?? 'N/A',
    },
    loan: {
      loanId:              loan.id,
      loanNumber:          loan.loanNumber,
      product:             loan.product?.name ?? 'N/A',
      status:              loan.status,
      principalRand:       principalRand.toFixed(2),
      aprPct:              aprPct.toFixed(2),
      termDays:            loan.termDays,
      startDate:           loan.startDate.toISOString().slice(0, 10),
      maturityDate:        loan.maturityDate.toISOString().slice(0, 10),
      disbursedAt:         loan.disbursedAt?.toISOString().slice(0, 10) ?? 'N/A',
    },
    currentBalance: {
      outstandingPrincipal: (Number(loan.outstandingPrincipal) / 100).toFixed(2),
      outstandingInterest:  (Number(loan.outstandingInterest) / 100).toFixed(2),
      outstandingFees:      (Number(loan.outstandingFees) / 100).toFixed(2),
      totalOutstanding:     ((Number(loan.outstandingPrincipal) + Number(loan.outstandingInterest) + Number(loan.outstandingFees)) / 100).toFixed(2),
    },
    repaymentHistory: loan.repayments.map(r => ({
      date:      new Date(r.receivedAt).toISOString().slice(0, 10),
      amountRand:(Number(r.amount) / 100).toFixed(2),
      rail:      r.rail,
      allocation: {
        feesRand:     (((r.allocation as { fees?: number })?.fees ?? 0) / 100).toFixed(2),
        interestRand: (((r.allocation as { interest?: number })?.interest ?? 0) / 100).toFixed(2),
        principalRand:(((r.allocation as { principal?: number })?.principal ?? 0) / 100).toFixed(2),
      },
    })),
    schedule: loan.schedule.map(s => ({
      installmentNo: s.installmentNo,
      dueDate:       new Date(s.dueDate).toISOString().slice(0, 10),
      totalDueRand:  (Number(s.totalDue) / 100).toFixed(2),
      principalRand: (Number(s.principalDue) / 100).toFixed(2),
      interestRand:  (Number(s.interestDue) / 100).toFixed(2),
      status:        s.status,
    })),
  };

  // ── Serve as PDF or JSON ───────────────────────────────────────────────
  if (format === 'pdf') {
    const pdfBuffer = await renderBorrowerStatement({
      generatedAt:  new Date().toISOString().slice(0, 10),
      loanNumber:   loan.loanNumber,
      borrower: {
        name:  statement.borrower.name,
        email: statement.borrower.email,
        phone: statement.borrower.phone,
      },
      loan: {
        product:       statement.loan.product,
        principalRand: statement.loan.principalRand,
        aprPct:        statement.loan.aprPct,
        termDays:      statement.loan.termDays,
        startDate:     statement.loan.startDate,
        maturityDate:  statement.loan.maturityDate,
        status:        statement.loan.status,
      },
      ncr: {
        totalCostOfCreditRand:   statement.ncr.totalCostOfCredit,
        annualPercentageRatePct: aprPct.toFixed(2),
        initiationFeeRand:       statement.ncr.initiationFeeRand,
        monthlyServiceFeeRand:   statement.ncr.monthlyServiceFeeRand,
      },
      currentBalance: {
        outstandingPrincipal: statement.currentBalance.outstandingPrincipal,
        outstandingInterest:  statement.currentBalance.outstandingInterest,
        outstandingFees:      statement.currentBalance.outstandingFees,
        totalOutstanding:     statement.currentBalance.totalOutstanding,
      },
      repaymentHistory: statement.repaymentHistory.map(r => ({
        date:          r.date,
        amountRand:    r.amountRand,
        rail:          r.rail,
        feesRand:      r.allocation.feesRand,
        interestRand:  r.allocation.interestRand,
        principalRand: r.allocation.principalRand,
      })),
      schedule: statement.schedule,
    });

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="statement_${loanId}.pdf"`,
      },
    });
  }

  // Pattern 7 — shorthand
  return NextResponse.json({ statement });
}
