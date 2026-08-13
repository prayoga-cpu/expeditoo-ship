import React from "react";
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
} from "@react-pdf/renderer";

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
        width: 100,
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
        width: 200,
        justifyContent: "space-between",
        marginBottom: 4,
    },
    grandTotal: {
        flexDirection: "row",
        width: 200,
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

interface InvoicePDFProps {
    invoiceNumber: string;
    invoiceDate: string;
    dueDate?: string;
    isPaid: boolean;
    paidDate?: string;
    // Seller/Company info
    companyName: string;
    companyAddress?: string;
    companyEmail?: string;
    // Buyer info
    buyerName: string;
    buyerEmail: string;
    buyerAddress?: string;
    // Line items
    items: Array<{
        description: string;
        quantity: number;
        unitPrice: number; // in cents
    }>;
    // Totals
    subtotal: number; // in cents
    shippingFee?: number; // in cents
    tax?: number; // in cents
    total: number; // in cents
    currency?: string;
}

const formatCurrency = (cents: number, currency = "EUR") => {
    const amount = cents / 100;
    return new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency,
    }).format(amount);
};

export const InvoicePDF = ({
    invoiceNumber,
    invoiceDate,
    dueDate,
    isPaid,
    paidDate,
    companyName,
    companyAddress,
    companyEmail,
    buyerName,
    buyerEmail,
    buyerAddress,
    items,
    subtotal,
    shippingFee = 0,
    tax = 0,
    total,
    currency = "EUR",
}: InvoicePDFProps) => (
    <Document>
        <Page size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.logo}>{companyName}</Text>
                    {companyAddress && <Text style={{ marginTop: 4 }}>{companyAddress}</Text>}
                    {companyEmail && <Text>{companyEmail}</Text>}
                </View>
                <View>
                    <Text style={styles.invoiceTitle}>INVOICE</Text>
                    <Text style={styles.invoiceNumber}>{invoiceNumber}</Text>
                </View>
            </View>

            {/* Paid Stamp */}
            {isPaid && <Text style={styles.paidStamp}>PAID</Text>}

            {/* Invoice Details */}
            <View style={styles.section}>
                <View style={styles.row}>
                    <Text style={styles.label}>Invoice Date:</Text>
                    <Text style={styles.value}>{invoiceDate}</Text>
                </View>
                {dueDate && (
                    <View style={styles.row}>
                        <Text style={styles.label}>Due Date:</Text>
                        <Text style={styles.value}>{dueDate}</Text>
                    </View>
                )}
                {isPaid && paidDate && (
                    <View style={styles.row}>
                        <Text style={styles.label}>Paid Date:</Text>
                        <Text style={styles.value}>{paidDate}</Text>
                    </View>
                )}
            </View>

            <View style={styles.divider} />

            {/* Bill To */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bill To</Text>
                <Text>{buyerName}</Text>
                <Text>{buyerEmail}</Text>
                {buyerAddress && <Text>{buyerAddress}</Text>}
            </View>

            {/* Items Table */}
            <View style={styles.table}>
                <View style={styles.tableHeader}>
                    <Text style={styles.tableColDesc}>Description</Text>
                    <Text style={styles.tableColQty}>Qty</Text>
                    <Text style={styles.tableColPrice}>Unit Price</Text>
                    <Text style={styles.tableColTotal}>Total</Text>
                </View>
                {items.map((item, index) => (
                    <View key={index} style={styles.tableRow}>
                        <Text style={styles.tableColDesc}>{item.description}</Text>
                        <Text style={styles.tableColQty}>{item.quantity}</Text>
                        <Text style={styles.tableColPrice}>
                            {formatCurrency(item.unitPrice, currency)}
                        </Text>
                        <Text style={styles.tableColTotal}>
                            {formatCurrency(item.unitPrice * item.quantity, currency)}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Totals */}
            <View style={styles.totals}>
                <View style={styles.totalRow}>
                    <Text>Subtotal</Text>
                    <Text>{formatCurrency(subtotal, currency)}</Text>
                </View>
                {shippingFee > 0 && (
                    <View style={styles.totalRow}>
                        <Text>Shipping</Text>
                        <Text>{formatCurrency(shippingFee, currency)}</Text>
                    </View>
                )}
                {tax > 0 && (
                    <View style={styles.totalRow}>
                        <Text>Tax</Text>
                        <Text>{formatCurrency(tax, currency)}</Text>
                    </View>
                )}
                <View style={styles.grandTotal}>
                    <Text style={styles.grandTotalLabel}>Total</Text>
                    <Text style={styles.grandTotalValue}>
                        {formatCurrency(total, currency)}
                    </Text>
                </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text>Thank you for your business!</Text>
                <Text style={{ marginTop: 4 }}>
                    This invoice was generated by Expeditoo
                </Text>
            </View>
        </Page>
    </Document>
);

export default InvoicePDF;
