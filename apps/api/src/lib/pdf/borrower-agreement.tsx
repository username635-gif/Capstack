/**
 * Borrower-facing loan agreement / contract PDF.
 *
 * AUDIENCE: BORROWER — the legally required copy of the credit agreement
 * that every consumer is entitled to under NCA s.93.
 *
 * CONTENTS:
 *   - Full NCA-compliant credit agreement text
 *   - All financial terms (principal, APR, total cost, fees)
 *   - Repayment schedule summary
 *   - Borrower's rights (s.86 debt review, s.125 early repayment, s.108 statements)
 *   - Consent and signature block
 *
 * IMPORTANT: This document must NOT include risk scores, credit bureau data,
 * internal notes, collections strategies, or any operational metadata.
 */

import React from 'react';
import { Document, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { shared, COLORS, PdfHeader, PdfFooter, KvRow } from './shared';

export interface AgreementData {
  generatedAt:    string;
  loanNumber:     string;
  borrower: {
    name:    string;
    email:   string;
    phone:   string;
    address: string;
  };
  lender: {
    name:           string;
    registrationNo: string;
    address:        string;
    ncrRegNo:       string;
  };
  loan: {
    product:           string;
    principalRand:     string;
    aprPct:            string;
    termDays:          number;
    startDate:         string;
    maturityDate:      string;
    disbursementMethod: string;
  };
  ncr: {
    totalCostOfCreditRand:   string;
    initiationFeeRand:       string;
    monthlyServiceFeeRand:   string;
    annualPercentageRatePct: string;
  };
  schedule: Array<{
    installmentNo: number;
    dueDate:       string;
    totalDueRand:  string;
  }>;
}

function AgreementPDF({ d }: { d: AgreementData }) {
  return (
    <Document title={`Credit Agreement — ${d.loanNumber}`} author="Capstack (Pty) Ltd">
      <Page size="A4" style={shared.page}>
        <PdfHeader title="Credit Agreement" generatedAt={d.generatedAt} />

        {/* NCA disclosure box — must appear prominently */}
        <View style={shared.infoBox}>
          <Text style={[shared.infoBoxText, { fontFamily: 'Helvetica-Bold', marginBottom: 4 }]}>
            NATIONAL CREDIT ACT 34 OF 2005 — SECTION 92 PRESCRIBED DISCLOSURE
          </Text>
          <Text style={shared.infoBoxText}>
            Principal debt: R {d.loan.principalRand}  ·  APR: {d.ncr.annualPercentageRatePct}%
            ·  Initiation fee: R {d.ncr.initiationFeeRand}  ·  Monthly service fee: R {d.ncr.monthlyServiceFeeRand}
          </Text>
          <Text style={[shared.infoBoxText, { fontFamily: 'Helvetica-Bold', marginTop: 4 }]}>
            TOTAL COST OF CREDIT: R {d.ncr.totalCostOfCreditRand}
          </Text>
        </View>

        {/* Parties */}
        <Text style={shared.sectionTitle}>1. Parties to this Agreement</Text>
        <Text style={{ fontSize: 8, color: COLORS.muted, marginBottom: 4 }}>CREDIT PROVIDER (Lender)</Text>
        <KvRow label="Name"            value={d.lender.name} />
        <KvRow label="Registration No" value={d.lender.registrationNo} />
        <KvRow label="NCR Reg. No."    value={d.lender.ncrRegNo} />
        <KvRow label="Address"         value={d.lender.address} />

        <Text style={{ fontSize: 8, color: COLORS.muted, marginTop: 8, marginBottom: 4 }}>CONSUMER (Borrower)</Text>
        <KvRow label="Full name" value={d.borrower.name} />
        <KvRow label="Email"     value={d.borrower.email} />
        <KvRow label="Phone"     value={d.borrower.phone} />
        <KvRow label="Address"   value={d.borrower.address} />

        {/* Credit terms */}
        <Text style={shared.sectionTitle}>2. Credit Terms</Text>
        <KvRow label="Agreement number"       value={d.loanNumber} />
        <KvRow label="Product type"           value={d.loan.product} />
        <KvRow label="Principal amount"       value={`R ${d.loan.principalRand}`} />
        <KvRow label="Annual Percentage Rate" value={`${d.loan.aprPct}%`} />
        <KvRow label="Loan term"              value={`${d.loan.termDays} days`} />
        <KvRow label="Agreement date"         value={d.loan.startDate} />
        <KvRow label="Final payment date"     value={d.loan.maturityDate} />
        <KvRow label="Disbursement method"    value={d.loan.disbursementMethod} />

        {/* Repayment schedule summary */}
        {d.schedule.length > 0 && (
          <>
            <Text style={shared.sectionTitle}>3. Repayment Schedule</Text>
            <View style={shared.table}>
              <View style={shared.tableHeader}>
                {['Installment #', 'Due Date', 'Amount Due'].map(h => (
                  <Text key={h} style={shared.tableHeaderCell}>{h}</Text>
                ))}
              </View>
              {d.schedule.map((s, i) => (
                <View key={i} style={[shared.tableRow, i % 2 === 1 ? shared.tableRowAlt : {}]}>
                  <Text style={shared.tableCell}>{s.installmentNo}</Text>
                  <Text style={shared.tableCell}>{s.dueDate}</Text>
                  <Text style={shared.tableCell}>R {s.totalDueRand}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Consumer rights */}
        <Text style={shared.sectionTitle}>4. Your Rights Under the National Credit Act</Text>
        {[
          ['s.86 — Debt review',     'You have the right to apply to a debt counsellor if you are over-indebted. Contact the NCR: ncr.org.za / 0860 627 627.'],
          ['s.125 — Early settlement','You may settle this agreement early at any time. A settlement amount will be calculated including all outstanding fees and a maximum 90-day interest penalty on the outstanding balance.'],
          ['s.108 — Statements',     'You are entitled to a free statement of account once a month. Additional statements may attract an admin fee disclosed in the pricing schedule.'],
          ['s.61 — Disclosure',      'You have the right to receive a copy of this agreement and any related documents at any time at no charge.'],
          ['s.100 — No unlawful fees','We may only charge fees expressly permitted under the NCA. Any fee not disclosed in this agreement is unlawful.'],
        ].map(([title, body]) => (
          <View key={title as string} style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.primary, marginBottom: 2 }}>{title as string}</Text>
            <Text style={{ fontSize: 7.5, color: COLORS.muted, lineHeight: 1.6 }}>{body as string}</Text>
          </View>
        ))}

        {/* Default consequences */}
        <Text style={shared.sectionTitle}>5. Default and Consequences</Text>
        <Text style={{ fontSize: 7.5, color: COLORS.muted, lineHeight: 1.7 }}>
          You will be in default if you fail to make a payment on the due date, provide false information, or become insolvent.
          On default we may: (a) charge default administration fees as permitted by the NCA; (b) report the default to credit bureaus;
          (c) commence legal proceedings to recover the outstanding balance; (d) hand the debt to a registered debt collector.
          We will give you 10 business days' written notice before any legal action.
        </Text>

        {/* Signature block */}
        <Text style={shared.sectionTitle}>6. Acceptance</Text>
        <View style={shared.warningBox}>
          <Text style={shared.warningText}>
            By submitting your loan application electronically you confirmed that you have read, understood, and agree to
            all terms of this credit agreement. Your electronic acceptance is legally binding under the Electronic
            Communications and Transactions Act 25 of 2002 (ECTA).
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 20, marginTop: 20 }}>
          {['Borrower signature', 'Credit provider authorisation'].map(label => (
            <View key={label} style={{ flex: 1 }}>
              <View style={{ borderBottomWidth: 0.5, borderBottomColor: COLORS.border, marginBottom: 4, height: 24 }} />
              <Text style={{ fontSize: 7, color: COLORS.muted }}>{label}</Text>
              <Text style={{ fontSize: 7, color: COLORS.muted, marginTop: 2 }}>Date: _______________</Text>
            </View>
          ))}
        </View>

        <PdfFooter loanRef={d.loanNumber} pageText="CREDIT AGREEMENT — NCA s.93 COPY" />
      </Page>
    </Document>
  );
}

export async function renderLoanAgreement(d: AgreementData): Promise<Buffer> {
  return renderToBuffer(<AgreementPDF d={d} />) as Promise<Buffer>;
}
