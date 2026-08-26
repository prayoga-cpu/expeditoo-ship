import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/currency";

/**
 * The carrier's period statement — the answer to Cocolis's "download all the
 * invoices for the period", one document rather than a bundle.
 *
 * It is a *relevé d'activité*, not a facture: a self-billing invoice asserting
 * a payable amount is a claim this repo cannot make while the commission split
 * is undecided (ROADMAP.md §10, billing_documents_spec.md §3.3). The footer
 * says so rather than leaving the reader to infer it.
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#333",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  logo: { fontSize: 22, fontWeight: "bold", color: "#000" },
  title: { fontSize: 14, fontWeight: "bold", textAlign: "right", color: "#666" },
  period: { fontSize: 10, textAlign: "right", marginTop: 4 },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 90, color: "#666" },
  value: { flex: 1, color: "#333" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  tableRow: {
    flexDirection: "row",
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  colDate: { width: "14%" },
  colRef: { width: "20%" },
  colRoute: { width: "30%" },
  colMoney: { width: "12%", textAlign: "right" },
  bold: { fontWeight: "bold" },
  totals: {
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    alignItems: "flex-end",
  },
  totalRow: { flexDirection: "row", marginBottom: 3 },
  totalLabel: { width: 140, color: "#666", textAlign: "right", marginRight: 12 },
  totalValue: { width: 80, textAlign: "right" },
  empty: { padding: 16, color: "#666", textAlign: "center" },
  note: {
    marginTop: 24,
    padding: 8,
    backgroundColor: "#fdf6e3",
    color: "#7a5c00",
    fontSize: 8,
  },
  footer: { marginTop: 20, fontSize: 8, color: "#999", textAlign: "center" },
});

export interface EarningsStatementLine {
  deliveredAt: Date | null;
  reference: string;
  listingTitle: string | null;
  pickupCity: string;
  dropoffCity: string;
  grossCents: number;
  commissionCents: number;
  netCents: number;
}

export interface EarningsStatementPDFProps {
  companyName: string;
  siret: string;
  periodLabel: string;
  generatedAt: string;
  currency: string;
  lines: EarningsStatementLine[];
  totals: {
    deliveries: number;
    grossCents: number;
    commissionCents: number;
    netCents: number;
    paidCents: number;
    pendingCents: number;
  };
  commissionRetainsAll: boolean;
  emptyLabel: string;
}

const day = (date: Date | null) =>
  date ? new Date(date).toLocaleDateString("fr-FR") : "—";

export const EarningsStatementPDF = ({
  companyName,
  siret,
  periodLabel,
  generatedAt,
  currency,
  lines,
  totals,
  commissionRetainsAll,
  emptyLabel,
}: EarningsStatementPDFProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.logo}>Expeditoo</Text>
        <View>
          <Text style={styles.title}>Relevé d&apos;activité</Text>
          <Text style={styles.period}>{periodLabel}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transporteur</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Raison sociale</Text>
          <Text style={styles.value}>{companyName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>SIRET</Text>
          <Text style={styles.value}>{siret}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Édité le</Text>
          <Text style={styles.value}>{generatedAt}</Text>
        </View>
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.colDate, styles.bold]}>Date</Text>
        <Text style={[styles.colRef, styles.bold]}>Référence</Text>
        <Text style={[styles.colRoute, styles.bold]}>Trajet</Text>
        <Text style={[styles.colMoney, styles.bold]}>Montant</Text>
        <Text style={[styles.colMoney, styles.bold]}>Commission</Text>
        <Text style={[styles.colMoney, styles.bold]}>Net</Text>
      </View>

      {lines.length === 0 ? (
        <Text style={styles.empty}>{emptyLabel}</Text>
      ) : (
        lines.map((line) => (
          <View key={line.reference} style={styles.tableRow} wrap={false}>
            <Text style={styles.colDate}>{day(line.deliveredAt)}</Text>
            <Text style={styles.colRef}>{line.reference}</Text>
            <Text style={styles.colRoute}>
              {line.pickupCity} → {line.dropoffCity}
            </Text>
            <Text style={styles.colMoney}>
              {formatCurrency(line.grossCents, { currency })}
            </Text>
            <Text style={styles.colMoney}>
              {formatCurrency(line.commissionCents, { currency })}
            </Text>
            <Text style={styles.colMoney}>
              {formatCurrency(line.netCents, { currency })}
            </Text>
          </View>
        ))
      )}

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Livraisons</Text>
          <Text style={styles.totalValue}>{totals.deliveries}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Montant total</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(totals.grossCents, { currency })}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Commission plateforme</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(totals.commissionCents, { currency })}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={[styles.totalLabel, styles.bold]}>Net transporteur</Text>
          <Text style={[styles.totalValue, styles.bold]}>
            {formatCurrency(totals.netCents, { currency })}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Dont versé</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(totals.paidCents, { currency })}
          </Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Dont en attente</Text>
          <Text style={styles.totalValue}>
            {formatCurrency(totals.pendingCents, { currency })}
          </Text>
        </View>
      </View>

      {commissionRetainsAll && (
        <Text style={styles.note}>
          Pendant la phase de test, la totalité du montant est conservée par la
          plateforme : aucun versement n&apos;est dû au titre de ce relevé. La
          répartition définitive reste à arrêter.
        </Text>
      )}

      <Text style={styles.footer}>
        Relevé d&apos;activité — document récapitulatif, ne vaut pas facture.
      </Text>
    </Page>
  </Document>
);
