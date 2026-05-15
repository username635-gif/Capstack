/**
 * Borrower-facing loan statement PDF.
 *
 * AUDIENCE: BORROWER — must NEVER include risk scores, PD scores,
 * internal adviser notes, collections status flags, or policy exceptions.
 *
 * CONTENTS:
 *   - NCR s.92 cost-of-credit disclosure (prominent, at the top)
 *   - Borrower and loan summary
 *   - Repayment history
 *   - Remaining amortization schedule
 *   - Outstanding balance breakdown
 */

import React from 'react';
import {
  Document, Page, Text, View, renderToBuffer,
} from '@react-pdf/renderer';
import { shared, COLORS, PdfHeader, PdfFooter, KvRow } from './shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StatementData {
  generatedAt:  string;
  loanNumber:   string;
  borrower: {
    name:  string;
    email: string;
    phone: string;
  };
  loan: {
    product:       string;
    principalRand: string;
    aprPct:        string;
    termDays:      number;
    startDate:     string;
    maturityDate:  string;
    status:        string;
  };
  ncr: {
    totalCostOfCreditRand:      string;
    annualPercentageRatePct:    string;
    initiationFeeRand:          string;
    monthlyServiceFeeRand:      string;
  };
  currentBalance: {
    outstandingPrincipal: string;
    outstandingInterest:  string;
    outstandingFees:      string;
    totalOutstanding:     string;
  };
  repaymentHistory: Array<{
    date:         string;
    amountRand:   string;
    rail:         string;
    feesRand:     string;
    interestRand: string;
    principalRand:string;
  }>;
  schedule: Array<{
    installmentNo: number;
    dueDate:       string;
    totalDueRand:  string;
    principalRand: string;
    interestRand:  string;
    status:        string;
  }>;
}

// ─── PDF Document ─────────────────────────────────────────────────────────────

function BorrowerStatementPDF({ d }: { d: StatementData }) {
  return (
    <Document title={`Loan Statement — ${d.loanNumber}`} author="Capstack (Pty) Ltd">
      <Page size="A4" style={shared.page}>
        <PdfHeader title="Loan Statement" generatedAt={d.generatedAt} />

        {/* NCR s.92 Disclosure — must be prominent */}
        <View style={shared.infoBox}>
          <Text style={[shared.infoBoxText, { fontFamily: 'Helvetica-Bold', marginBottom: 3 }]}>
            National Credit Act — s.92 Cost of Credit Disclosure
          </Text>
          <Text style={shared.infoBoxText}>
            Annual Percentage Rate (APR): {d.ncr.annualPercentageRatePct}%   ·
            Total Cost of Credit: R {d.ncr.totalCostOfCreditRand}   ·
            Initiation Fee: R {d.ncr.initiationFeeRand}   ·
            Monthly Service Fee: R {d.ncr.monthlyServiceFeeRand}
          </Text>
          <Text style={[shared.infoBoxText, { marginTop: 3 }]}>
            The total cost of credit includes all principal, interest, and fees payable over the loan term as required by NCA s.92.
          </Text>
        </View>

        {/* Borrower */}
        <Text style={shared.sectionTitle}>Borrower Details</Text>
        <KvRow label="Full name"  value={d.borrower.name} />
        <KvRow label="Email"      value={d.borrower.email} />
        <KvRow label="Phone"      value={d.borrower.phone} />

        {/* Loan summary */}
        <Text style={shared.sectionTitle}>Loan Summary</Text>
        <KvRow label="Loan number"    value={d.loanNumber} />
        <KvRow label="Product"        value={d.loan.product} />
        <KvRow label="Principal"      value={`R ${d.loan.principalRand}`} />
        <KvRow label="APR"            value={`${d.loan.aprPct}%`} />
        <KvRow label="Term"           value={`${d.loan.termDays} days`} />
        <KvRow label="Start date"     value={d.loan.startDate} />
        <KvRow label="Maturity date"  value={d.loan.maturityDate} />
        <KvRow label="Status"         value={d.loan.status} />

        {/* Current balance */}
        <Text style={shared.sectionTitle}>Current Balance</Text>
        <KvRow label="Outstanding principal"  value={`R ${d.currentBalance.outstandingPrincipal}`} />
        <KvRow label="Outstanding interest"   value={`R ${d.currentBalance.outstandingInterest}`} />
        <KvRow label="Outstanding fees"       value={`R ${d.currentBalance.outstandingFees}`} />
        <KvRow label="Total outstanding"      value={`R ${d.currentBalance.totalOutstanding}`} />

        {/* Repayment history */}
        {d.repaymentHistory.length > 0 && (
          <>
            <Text style={shared.sectionTitle}>Repayment History</Text>
            <View style={shared.table}>
              <View style={shared.tableHeader}>
                {['Date', 'Amount', 'Principal', 'Interest', 'Fees', 'Channel'].map(h => (
                  <Text key={h} style={shared.tableHeaderCell}>{h}</Text>
                ))}
              </View>
              {d.repaymentHistory.map((r, i) => (
                <View key={i} style={[shared.tableRow, i % 2 === 1 ? shared.tableRowAlt : {}]}>
                  <Text style={shared.tableCell}>{r.date}</Text>
                  <Text style={shared.tableCell}>R {r.amountRand}</Text>
                  <Text style={shared.tableCell}>R {r.principalRand}</Text>
                  <Text style={shared.tableCell}>R {r.interestRand}</Text>
                  <Text style={shared.tableCell}>R {r.feesRand}</Text>
                  <Text style={shared.tableCell}>{r.rail}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Amortization schedule */}
        {d.schedule.length > 0 && (
          <>
            <Text style={shared.sectionTitle}>Repayment Schedule</Text>
            <View style={shared.table}>
              <View style={shared.tableHeader}>
                {['#', 'Due date', 'Total due', 'Principal', 'Interest', 'Status'].map(h => (
                  <Text key={h} style={shared.tableHeaderCell}>{h}</Text>
                ))}
              </View>
              {d.schedule.map((s, i) => (
                <View key={i} style={[shared.tableRow, i % 2 === 1 ? shared.tableRowAlt : {}]}>
                  <Text style={shared.tableCell}>{s.installmentNo}</Text>
                  <Text style={shared.tableCell}>{s.dueDate}</Text>
                  <Text style={shared.tableCell}>R {s.totalDueRand}</Text>
                  <Text style={shared.tableCell}>R {s.principalRand}</Text>
                  <Text style={shared.tableCell}>R {s.interestRand}</Text>
                  <Text style={[shared.tableCell, { color: s.status === 'OVERDUE' ? COLORS.danger : COLORS.muted }]}>
                    {s.status}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={shared.warningBox}>
          <Text style={shared.warningText}>
            This statement is for the addressee only. Keep for your records — it may be required for tax, insurance, or dispute purposes.
            This document does not constitute a tax certificate. For a Section 18A certificate contact your tax adviser.
          </Text>
        </View>

        <PdfFooter loanRef={d.loanNumber} pageText="BORROWER STATEMENT" />
      </Page>
    </Document>
  );
}

export async function renderBorrowerStatement(d: StatementData): Promise<Buffer> {
  return renderToBuffer(<BorrowerStatementPDF d={d} />) as Promise<Buffer>;
}
