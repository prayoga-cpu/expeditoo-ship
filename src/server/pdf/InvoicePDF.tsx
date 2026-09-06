import React from "react";
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
} from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/currency";
import type { InvoiceIssuer } from "@/lib/invoice-issuer";

// Styles for the invoice PDF
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: "Helvetica",
        fontSize: 10,
        color: "#333",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 30,
    },
    logo: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#000",
    },
    issuerLine: {
        marginTop: 2,
        fontSize: 8,
        color: "#666",
    },
    invoiceTitle: {
        fontSize: 16,
        fontWeight: "bold",
        textAlign: "right",
        color: "#666",
    },
    invoiceNumber: {
        fontSize: 12,
        textAlign: "right",
        marginTop: 4,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: "bold",
        color: "#666",
        marginBottom: 8,
        textTransform: "uppercase",
    },
    row: {
        flexDirection: "row",
        marginBottom: 4,
    },
    label: {
        width: 120,
        color: "#666",
    },
    value: {
        flex: 1,
        color: "#333",
    },
    divider: {
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
        marginVertical: 20,
    },
    table: {
        marginTop: 10,
    },
    tableHeader: {
        flexDirection: "row",
        backgroundColor: "#f5f5f5",
        padding: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
    },
    tableRow: {
        flexDirection: "row",
        padding: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    tableColDesc: {
        flex: 3,
    },
    tableColQty: {
        flex: 1,
        textAlign: "center",
    },
    tableColPrice: {
        flex: 1,
        textAlign: "right",
    },
    tableColTotal: {
        flex: 1,
        textAlign: "right",
        fontWeight: "bold",
    },
    totals: {
        marginTop: 20,
        alignItems: "flex-end",
    },
    totalRow: {
        flexDirection: "row",
        width: 220,
        justifyContent: "space-between",
        marginBottom: 4,
    },
    grandTotal: {
        flexDirection: "row",
        width: 220,
        justifyContent: "space-between",
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 2,
        borderTopColor: "#333",
    },
    grandTotalLabel: {
        fontSize: 12,
        fontWeight: "bold",
    },
    grandTotalValue: {
        fontSize: 12,
        fontWeight: "bold",
    },
    vatMention: {
        marginTop: 16,
        fontSize: 9,
        color: "#666",
    },
    notice: {
        marginTop: 16,
        padding: 8,
        borderWidth: 1,
        borderColor: "#f59e0b",
        color: "#b45309",
        fontSize: 9,
    },
    footer: {
        position: "absolute",
        bottom: 40,
        left: 40,
        right: 40,
        textAlign: "center",
        color: "#999",
        fontSize: 8,
    },
    paidStamp: {
        position: "absolute",
        top: 100,
        right: 40,
        fontSize: 24,
        fontWeight: "bold",
        color: "#22c55e",
        transform: "rotate(-15deg)",
        opacity: 0.5,
        borderWidth: 3,
        borderColor: "#22c55e",
        padding: 10,
    },
});

export interface InvoicePDFProps {
    /** *Facture* or *Reçu de paiement* — decided by `invoice-pdf-props.ts`, never here. */
    documentTitle: string;
    documentNumber: string;
    /** The document this one corrects — an avoir must name its facture. */
    correctsDocumentNumber?: string;
    issueDate: string;
    dueDate?: string;
    /** True only when real money moved through this platform's Stripe account. */
    isPaid: boolean;
    paidDate?: string;
    /** Printed in place of the stamp when the charge was synthetic. */
    testNotice?: string;
    issuer: InvoiceIssuer;
    // Billed party
    buyerName: string;
    buyerEmail: string;
    buyerAddress?: string;
    // Line items
    items: Array<{
        description: string;
        quantity: number;
        unitPrice: number; // in cents
    }>;
    // Totals, in cents
    subtotal: number;
    vat: number;
    total: number;
    vatMention: string;
    footerNote: string;
    currency?: string;
}

/** The issuer block, printing only the identifiers that actually exist. */
const IssuerIdentity = ({ issuer }: { issuer: InvoiceIssuer }) => (
    <View>
        <Text style={styles.logo}>{issuer.name}</Text>
        {issuer.legalForm && (
            <Text style={styles.issuerLine}>
                {issuer.legalForm}
                {issuer.capital ? ` au capital de ${issuer.capital}` : ""}
            </Text>
        )}
        {issuer.address && <Text style={styles.issuerLine}>{issuer.address}</Text>}
        {issuer.siret && <Text style={styles.issuerLine}>SIRET {issuer.siret}</Text>}
        {issuer.rcs && <Text style={styles.issuerLine}>RCS {issuer.rcs}</Text>}
        {issuer.vatNumber && (
            <Text style={styles.issuerLine}>TVA {issuer.vatNumber}</Text>
        )}
        <Text style={styles.issuerLine}>{issuer.email}</Text>
    </View>
);

/**
 * One document as a single page, so the same layout serves the download, the
 * period bundle and the email attachment (invoice_at_payment_spec.md §7.1).
 *
 * French throughout. It used to read INVOICE / Bill To / "Thank you for your
 * business!" with fr-FR dates, reached from a screen called *Mes factures* — an
 * English document is the least defensible version of a French client's own
 * receipt.
 */
export const InvoicePage = ({
    documentTitle,
    documentNumber,
    correctsDocumentNumber,
    issueDate,
    dueDate,
    isPaid,
    paidDate,
    testNotice,
    issuer,
    buyerName,
    buyerEmail,
    buyerAddress,
    items,
    subtotal,
    vat,
    total,
    vatMention,
    footerNote,
    currency = "EUR",
}: InvoicePDFProps) => (
        <Page size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
                <IssuerIdentity issuer={issuer} />
                <View>
                    <Text style={styles.invoiceTitle}>{documentTitle.toUpperCase()}</Text>
                    <Text style={styles.invoiceNumber}>{documentNumber}</Text>
                </View>
            </View>

            {/* Paid Stamp */}
            {isPaid && <Text style={styles.paidStamp}>PAYÉ</Text>}

            {/* Document details */}
            <View style={styles.section}>
                <View style={styles.row}>
                    <Text style={styles.label}>Date d&apos;émission :</Text>
                    <Text style={styles.value}>{issueDate}</Text>
                </View>
                {correctsDocumentNumber && (
                    <View style={styles.row}>
                        <Text style={styles.label}>Avoir sur :</Text>
                        <Text style={styles.value}>{correctsDocumentNumber}</Text>
                    </View>
                )}
                {dueDate && (
                    <View style={styles.row}>
                        <Text style={styles.label}>Échéance :</Text>
                        <Text style={styles.value}>{dueDate}</Text>
                    </View>
                )}
                {isPaid && paidDate && (
                    <View style={styles.row}>
                        <Text style={styles.label}>Date de paiement :</Text>
                        <Text style={styles.value}>{paidDate}</Text>
                    </View>
                )}
            </View>

            <View style={styles.divider} />

            {/* Billed party */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Facturé à</Text>
                <Text>{buyerName}</Text>
                <Text>{buyerEmail}</Text>
                {buyerAddress && <Text>{buyerAddress}</Text>}
            </View>

            {/* Items Table */}
            <View style={styles.table}>
                <View style={styles.tableHeader}>
                    <Text style={styles.tableColDesc}>Désignation</Text>
                    <Text style={styles.tableColQty}>Qté</Text>
                    <Text style={styles.tableColPrice}>Prix unitaire</Text>
                    <Text style={styles.tableColTotal}>Total</Text>
                </View>
                {items.map((item, index) => (
                    <View key={index} style={styles.tableRow}>
                        <Text style={styles.tableColDesc}>{item.description}</Text>
                        <Text style={styles.tableColQty}>{item.quantity}</Text>
                        <Text style={styles.tableColPrice}>
                            {formatCurrency(item.unitPrice, { currency })}
                        </Text>
                        <Text style={styles.tableColTotal}>
                            {formatCurrency(item.unitPrice * item.quantity, { currency })}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Totals */}
            <View style={styles.totals}>
                <View style={styles.totalRow}>
                    <Text>{vat === 0 ? "Montant" : "Total HT"}</Text>
                    <Text>{formatCurrency(subtotal, { currency })}</Text>
                </View>
                {vat !== 0 && (
                    <View style={styles.totalRow}>
                        <Text>TVA</Text>
                        <Text>{formatCurrency(vat, { currency })}</Text>
                    </View>
                )}
                <View style={styles.grandTotal}>
                    <Text style={styles.grandTotalLabel}>
                        {vat === 0 ? "Montant réglé" : "Total TTC"}
                    </Text>
                    <Text style={styles.grandTotalValue}>
                        {formatCurrency(total, { currency })}
                    </Text>
                </View>
            </View>

            {/* A French document states its VAT treatment or states why there is
                none. Silence is the one option that is not available. */}
            <Text style={styles.vatMention}>{vatMention}</Text>

            {testNotice && <Text style={styles.notice}>{testNotice}</Text>}

            {/* Footer */}
            <View style={styles.footer}>
                <Text>{footerNote}</Text>
            </View>
        </Page>
);

export const InvoicePDF = (props: InvoicePDFProps) => (
    <Document>
        <InvoicePage {...props} />
    </Document>
);

/**
 * Every document in a period, one page each — the Cocolis bulk download.
 *
 * An empty period still produces a document: an empty statement is a
 * meaningful accounting artefact, and @react-pdf cannot render a Document with
 * no pages at all (billing_documents_spec.md §6.4).
 */
export const InvoiceBatchPDF = ({
    invoices,
    periodLabel,
    emptyLabel,
}: {
    invoices: (InvoicePDFProps & { key: string })[];
    periodLabel: string;
    emptyLabel: string;
}) => (
    <Document>
        {invoices.length === 0 ? (
            <Page size="A4" style={styles.page}>
                <View style={styles.header}>
                    <Text style={styles.logo}>Expeditoo</Text>
                    <View>
                        <Text style={styles.invoiceTitle}>FACTURES</Text>
                        <Text style={styles.invoiceNumber}>{periodLabel}</Text>
                    </View>
                </View>
                <View style={styles.divider} />
                <Text>{emptyLabel}</Text>
            </Page>
        ) : (
            invoices.map(({ key, ...invoice }) => (
                <InvoicePage key={key} {...invoice} />
            ))
        )}
    </Document>
);

export default InvoicePDF;
