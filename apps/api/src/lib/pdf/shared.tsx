/**
 * Shared PDF primitives — colours, typography, header/footer.
 *
 * All Capstack PDF documents import from here so branding is
 * consistent and changes are made in one place.
 *
 * NEVER include internal risk scores, pd scores, adviser comments,
 * or operations notes in any document that has audience = 'BORROWER'.
 */

import React from 'react';
import { StyleSheet, Font, View, Text } from '@react-pdf/renderer';

// ─── Brand tokens ─────────────────────────────────────────────────────────────

export const COLORS = {
  primary:    '#0F2B3D',
  secondary:  '#14B8A6',
  accent:     '#F59E0B',
  danger:     '#DC2626',
  muted:      '#64748B',
  border:     '#E2E8F0',
  surface:    '#F8FAFC',
  white:      '#FFFFFF',
  text:       '#1E293B',
};

// ─── Shared styles ────────────────────────────────────────────────────────────

export const shared = StyleSheet.create({
  page: {
    fontFamily:  'Helvetica',
    fontSize:    9,
    color:       COLORS.text,
    paddingTop:  48,
    paddingBottom: 56,
    paddingHorizontal: 40,
    backgroundColor: COLORS.white,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems:    'flex-start',
    marginBottom:  24,
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.secondary,
  },
  logoText: {
    fontSize:    18,
    fontFamily:  'Helvetica-Bold',
    color:       COLORS.primary,
    letterSpacing: 0.5,
  },
  logoSub: {
    fontSize:  8,
    color:     COLORS.muted,
    marginTop: 2,
  },
  headerMeta: {
    textAlign: 'right',
    fontSize:  8,
    color:     COLORS.muted,
    lineHeight: 1.6,
  },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: {
    position:   'absolute',
    bottom:     24,
    left:       40,
    right:      40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  footerText: {
    fontSize: 7,
    color:    COLORS.muted,
  },

  // ── Section headings ───────────────────────────────────────────────────────
  sectionTitle: {
    fontSize:    10,
    fontFamily:  'Helvetica-Bold',
    color:       COLORS.primary,
    marginTop:   18,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },

  // ── Key-value pairs ────────────────────────────────────────────────────────
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 0.3,
    borderBottomColor: COLORS.border,
  },
  kvLabel: {
    fontSize: 8,
    color:    COLORS.muted,
    width:    '45%',
  },
  kvValue: {
    fontSize:   8,
    fontFamily: 'Helvetica-Bold',
    color:      COLORS.text,
    width:      '55%',
    textAlign:  'right',
  },

  // ── Tables ─────────────────────────────────────────────────────────────────
  table: {
    marginTop: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize:   7,
    fontFamily: 'Helvetica-Bold',
    color:      COLORS.white,
    flex:       1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 0.3,
    borderBottomColor: COLORS.border,
  },
  tableRowAlt: {
    backgroundColor: COLORS.surface,
  },
  tableCell: {
    fontSize: 7.5,
    color:    COLORS.text,
    flex:     1,
  },

  // ── Info box / disclaimer ──────────────────────────────────────────────────
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.secondary,
    padding:         8,
    marginTop:       10,
    marginBottom:    4,
    borderRadius:    3,
  },
  infoBoxText: {
    fontSize:   7.5,
    color:      '#1D4ED8',
    lineHeight: 1.6,
  },
  warningBox: {
    backgroundColor: '#FFF7ED',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    padding:         8,
    marginTop:       10,
    borderRadius:    3,
  },
  warningText: {
    fontSize:   7.5,
    color:      '#92400E',
    lineHeight: 1.6,
  },
  dangerBox: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.danger,
    padding:         8,
    marginTop:       10,
    borderRadius:    3,
  },
  dangerText: {
    fontSize:   7.5,
    color:      '#991B1B',
    lineHeight: 1.6,
  },
});

// ─── Re-usable components ─────────────────────────────────────────────────────

export function PdfHeader({ title, subtitle, generatedAt }: {
  title:       string;
  subtitle?:   string;
  generatedAt: string;
}) {
  return (
    <View style={shared.headerRow}>
      <View>
        <Text style={shared.logoText}>Capstack</Text>
        <Text style={shared.logoSub}>Capstack (Pty) Ltd · NCR Reg. pending</Text>
        {subtitle && <Text style={[shared.logoSub, { marginTop: 6, color: COLORS.secondary, fontFamily: 'Helvetica-Bold' }]}>{title}</Text>}
      </View>
      <View style={shared.headerMeta}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: COLORS.primary }}>{subtitle ? subtitle : title}</Text>
        <Text>Generated: {generatedAt}</Text>
        <Text>Confidential — {subtitle ? 'Internal use only' : 'For addressee only'}</Text>
      </View>
    </View>
  );
}

export function PdfFooter({ pageText, loanRef }: { pageText?: string; loanRef?: string }) {
  return (
    <View style={shared.footer} fixed>
      <Text style={shared.footerText}>Capstack (Pty) Ltd · capstack.co.za · NCR Reg. pending</Text>
      {loanRef && <Text style={shared.footerText}>Ref: {loanRef}</Text>}
      <Text style={shared.footerText}>{pageText ?? 'CONFIDENTIAL'}</Text>
    </View>
  );
}

export function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={shared.kvRow}>
      <Text style={shared.kvLabel}>{label}</Text>
      <Text style={shared.kvValue}>{value}</Text>
    </View>
  );
}
