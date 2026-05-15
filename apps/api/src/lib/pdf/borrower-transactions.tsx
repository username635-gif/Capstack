/**
 * Borrower-facing transaction history PDF.
 *
 * AUDIENCE: BORROWER — their personal financial record across all loans.
 * No internal scores, risk ratings, or collections notes included.
 *
 * CONTENTS:
 *   - All disbursements received
 *   - All repayments made (with NCA waterfall breakdown)
 *   - Running balance per loan
 *   - Summary totals (total borrowed, total repaid, net position)
 */

import React from 'react';
import { Document, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { shared, COLORS, PdfHeader, PdfFooter, KvRow } from './shared';

export interface TransactionHistoryData {
  generatedAt: string;
  borrower: {
    name:  string;
    email: string;
  };
  summary: {
    totalDisbursedRand:  string;
    totalRepaidRand:     string;
    totalOutstandingRand: string;
    activeLoanCount:     number;
  };
  loans: Array<{
    loanNumber:  string;
    product:     string;
    status:      string;
    principalRand: string;
    transactions: Array<{
      date:       string;
      type:       'DISBURSEMENT' | 'REPAYMENT' | 'FEE' | 'INTEREST_ACCRUAL';
      amountRand: string;
      description: string;
      runningBalanceRand: string;
    }>;
  }>;
}

const TYPE_COLOR: Record<string, string> = {
  DISBURSEMENT:       COLORS.secondary,
  REPAYMENT:          '#059669',
  FEE:                COLORS.accent,
  INTEREST_ACCRUAL:   COLORS.muted,
};

function TransactionHistoryPDF({ d }: { d: TransactionHistoryData }) {
  return (
    <Document title={`Transaction History — ${d.borrower.name}`} author="Capstack (Pty) Ltd">
      <Page size="A4" style={shared.page}>
        <PdfHeader title="Transaction History" generatedAt={d.generatedAt} />

        {/* Borrower */}
        <Text style={shared.sectionTitle}>Account Holder</Text>
        <KvRow label="Name"  value={d.borrower.name} />
        <KvRow label="Email" value={d.borrower.email} />

        {/* Summary */}
        <Text style={shared.sectionTitle}>Summary</Text>
        <KvRow label="Total disbursed"   value={`R ${d.summary.totalDisbursedRand}`} />
        <KvRow label="Total repaid"      value={`R ${d.summary.totalRepaidRand}`} />
        <KvRow label="Total outstanding" value={`R ${d.summary.totalOutstandingRand}`} />
        <KvRow label="Active loans"      value={String(d.summary.activeLoanCount)} />

        {/* Per-loan transaction detail */}
        {d.loans.map(loan => (
          <View key={loan.loanNumber}>
            <Text style={[shared.sectionTitle, { marginTop: 14 }]}>
              {loan.loanNumber} — {loan.product} ({loan.status})
            </Text>
            <KvRow label="Principal" value={`R ${loan.principalRand}`} />

            {loan.transactions.length === 0 ? (
              <Text style={{ fontSize: 7.5, color: COLORS.muted, marginTop: 4 }}>No transactions recorded.</Text>
            ) : (
              <View style={shared.table}>
                <View style={shared.tableHeader}>
                  {['Date', 'Type', 'Description', 'Amount', 'Balance'].map(h => (
                    <Text key={h} style={shared.tableHeaderCell}>{h}</Text>
                  ))}
                </View>
                {loan.transactions.map((t, i) => (
                  <View key={i} style={[shared.tableRow, i % 2 === 1 ? shared.tableRowAlt : {}]}>
                    <Text style={shared.tableCell}>{t.date}</Text>
                    <Text style={[shared.tableCell, { color: TYPE_COLOR[t.type] ?? COLORS.text, fontFamily: 'Helvetica-Bold' }]}>
                      {t.type.replace('_', ' ')}
                    </Text>
                    <Text style={[shared.tableCell, { flex: 2 }]}>{t.description}</Text>
                    <Text style={shared.tableCell}>R {t.amountRand}</Text>
                    <Text style={shared.tableCell}>R {t.runningBalanceRand}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        <View style={[shared.infoBox, { marginTop: 16 }]}>
          <Text style={shared.infoBoxText}>
            This transaction history is provided for your personal financial records.
            It may be used for tax purposes, dispute resolution, or as proof of repayments.
            This document does not constitute a tax certificate. Keep this document in a safe place.
          </Text>
        </View>

        <PdfFooter pageText="TRANSACTION HISTORY — CONFIDENTIAL" />
      </Page>
    </Document>
  );
}

export async function renderTransactionHistory(d: TransactionHistoryData): Promise<Buffer> {
  return renderToBuffer(<TransactionHistoryPDF d={d} />) as Promise<Buffer>;
}
