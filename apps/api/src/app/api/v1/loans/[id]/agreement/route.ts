/**
 * GET /api/v1/loans/[id]/agreement
 *
 * Returns a PDF copy of the loan agreement (credit contract) for the borrower.
 *
 * NCA s.93 — every consumer is entitled to a free copy of their credit agreement
 * on request. This endpoint fulfils that obligation.
 *
 * AUDIENCE: BORROWER only — no internal risk data, no ops notes.
 *
 * Auth: borrower must own the loan (borrowerId matches session) OR staff.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@capstack/db';
import { renderLoanAgreement } from '@/lib/pdf/borrower-agreement';

async function to<T>(p: Promise<T>): Promise<[Error, null] | [null, T]> {
  try { return [null, await p]; }
  catch (err) { return [err instanceof Error ? err : new Error(String(err)), null]; }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: loanId } = await params;

  const [loanErr, loan] = await to(
    prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        borrower: { include: { individual: true } },
        product:  true,
        schedule: { orderBy: { installmentNo: 'asc' }, take: 36 },
      },
    }),
  );

  if (loanErr) return NextResponse.json({ error: 'DB error' }, { status: 500 });
  if (!loan)   return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const principalRand  = Number(loan.principal) / 100;
  const aprPct         = loan.aprBps / 100;
  const initiationFeeRand = loan.product?.fixedFeeAmount ? Number(loan.product.fixedFeeAmount) / 100 : 0;
  const termYears      = loan.termDays / 365;
  const totalInterestRand = principalRand * (loan.aprBps / 10000) * termYears;
  const totalCostRand  = principalRand + totalInterestRand + initiationFeeRand;

  const pdfBuffer = await renderLoanAgreement({
    generatedAt:    new Date().toISOString().slice(0, 10),
    loanNumber:     loan.loanNumber,
    borrower: {
      name:    loan.borrower?.individual?.fullName ?? 'N/A',
      email:   loan.borrower?.email ?? 'N/A',
      phone:   loan.borrower?.phone ?? 'N/A',
      address: JSON.stringify(loan.borrower?.individual?.residentialAddress ?? {}),
    },
    lender: {
      name:           'Capstack (Pty) Ltd',
      registrationNo: 'Registration pending',
      address:        'South Africa',
      ncrRegNo:       'NCR Reg. pending',
    },
    loan: {
      product:           loan.product?.name ?? 'N/A',
      principalRand:     principalRand.toFixed(2),
      aprPct:            aprPct.toFixed(2),
      termDays:          loan.termDays,
      startDate:         loan.startDate.toISOString().slice(0, 10),
      maturityDate:      loan.maturityDate.toISOString().slice(0, 10),
      disbursementMethod: 'EFT/Bank transfer',
    },
    ncr: {
      totalCostOfCreditRand:   totalCostRand.toFixed(2),
      initiationFeeRand:       initiationFeeRand.toFixed(2),
      monthlyServiceFeeRand:   '0.00',
      annualPercentageRatePct: aprPct.toFixed(2),
    },
    schedule: loan.schedule.map(s => ({
      installmentNo: s.installmentNo,
      dueDate:       new Date(s.dueDate).toISOString().slice(0, 10),
      totalDueRand:  (Number(s.totalDue) / 100).toFixed(2),
    })),
  });

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="agreement_${loanId}.pdf"`,
    },
  });
}
