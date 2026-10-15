import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../../messages/en.json";
import fr from "../../../../../../../messages/fr.json";
import { periodBoundsIso } from "@/lib/statement-period";

/**
 * client_feedback_2026_10_spec.md §7a — « Historique des transactions ».
 *
 * The hooks and client APIs are the real ones; only `fetch` is answered, so
 * the URLs each tab reads and links to are what is asserted. Roles come from
 * the profile's own hook, stood in for per case.
 */

const nav = vi.hoisted(() => ({
    params: new URLSearchParams(),
    replace: vi.fn(),
    roles: { data: ["shipper", "carrier"] as string[] | undefined, isLoading: false },
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: nav.replace }),
    useSearchParams: () => nav.params,
}));
vi.mock("../../../hooks/useUserRoles", () => ({
    useUserRoles: () => nav.roles,
}));
vi.mock("@/components/ui/page-loader", () => ({
    PageLoader: () => <div data-testid="loader" />,
    InlineLoader: () => <div data-testid="inline-loader" />,
}));

import { TransactionHistory } from "../TransactionHistory";

// ========================================
// What the server answers
// ========================================

const invoice = (over: Record<string, unknown> = {}) => ({
    id: "inv-1",
    invoiceNumber: "INV-2026-0001",
    paymentId: "pay-1",
    userId: "user-1",
    amount: 18_000,
    currency: "eur",
    status: "paid",
    kind: "invoice",
    documentType: "receipt",
    relatedInvoiceId: null,
    relatedInvoiceNumber: null,
    issuedAt: "2026-09-01T10:00:00.000Z",
    dueAt: null,
    paidAt: "2026-09-01T10:00:00.000Z",
    pdfUrl: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    ...over,
});

const earningsItem = (over: Record<string, unknown> = {}) => ({
    shipmentId: "ship-1",
    listingId: "listing-1",
    listingTitle: "Palette Lyon → Paris",
    reference: "100042",
    deliveredAt: "2026-09-03T15:00:00.000Z",
    pickupCity: "Lyon",
    dropoffCity: "Paris",
    priceCents: 20_000,
    grossCents: 20_000,
    commissionCents: 2_000,
    netCents: 18_000,
    capturedAt: "2026-09-01T10:00:00.000Z",
    paymentStatus: "captured",
    payoutStatus: "scheduled",
    paidAt: null,
    ...over,
});

const server = {
    invoices: [] as unknown[],
    invoicesFail: false,
    earnings: [] as unknown[],
    earningsTotal: undefined as number | undefined,
    earningsFail: false,
    earningsNoCarrier: false,
};

const answer = (data: unknown) =>
    new Response(JSON.stringify({ success: true, data }));
const refuse = (code: string, status: number) =>
    new Response(JSON.stringify({ success: false, error: { code, message: code } }), {
        status,
    });

function earningsPage() {
    const items = server.earnings as ReturnType<typeof earningsItem>[];
    const sum = (key: "grossCents" | "commissionCents" | "netCents") =>
        items.reduce((total, item) => total + item[key], 0);
    const total = server.earningsTotal ?? items.length;

    return {
        items,
        summary: {
            deliveries: total,
            grossCents: sum("grossCents"),
            commissionCents: sum("commissionCents"),
            netCents: sum("netCents"),
            paidCents: 0,
            pendingCents: sum("netCents"),
        },
        total,
        page: 1,
        limit: 100,
        totalPages: 1,
        commissionRetainsAll: false,
    };
}

const fetchSpy = vi.fn(async (url: string) => {
    if (url.startsWith("/api/user/invoices")) {
        if (server.invoicesFail) return refuse("INTERNAL_ERROR", 500);
        const items = server.invoices;
        return answer({ items, total: items.length, page: 1, limit: 20, totalPages: 1 });
    }
    if (url.startsWith("/api/carrier/earnings")) {
        if (server.earningsFail) return refuse("INTERNAL_ERROR", 500);
        if (server.earningsNoCarrier) return refuse("CARRIER_NOT_FOUND", 404);
        return answer(earningsPage());
    }
    return refuse("NOT_FOUND", 404);
});

const urlsFetched = () => fetchSpy.mock.calls.map(([url]) => url);

beforeEach(() => {
    nav.params = new URLSearchParams();
    nav.replace.mockClear();
    nav.roles = { data: ["shipper", "carrier"], isLoading: false };
    server.invoices = [invoice()];
    server.invoicesFail = false;
    server.earnings = [earningsItem()];
    server.earningsTotal = undefined;
    server.earningsFail = false;
    server.earningsNoCarrier = false;
    fetchSpy.mockClear();
    vi.stubGlobal("fetch", fetchSpy);
    // Radix Select reaches for these on open and on typeahead.
    window.HTMLElement.prototype.hasPointerCapture ??= () => false;
    window.HTMLElement.prototype.setPointerCapture ??= () => {};
    window.HTMLElement.prototype.releasePointerCapture ??= () => {};
    window.HTMLElement.prototype.scrollIntoView ??= () => {};
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function renderHistory(locale: "en" | "fr" = "en") {
    const onError = vi.fn<(error: Error) => void>();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
        <QueryClientProvider client={client}>
            <NextIntlClientProvider
                locale={locale}
                messages={locale === "fr" ? fr : en}
                onError={onError}
                timeZone="Europe/Paris"
            >
                <TransactionHistory />
            </NextIntlClientProvider>
        </QueryClientProvider>
    );
    return onError;
}

const tab = (name: string) => screen.queryByRole("tab", { name });
const t = en.profile.invoices;

// ========================================
// The tabs
// ========================================

describe("TransactionHistory — tabs", () => {
    it("is titled « Transaction history »", () => {
        renderHistory();
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Transaction history"
        );
    });

    it("opens on the requester's documents when the URL names no tab", async () => {
        renderHistory();

        expect(tab(t.tabs.requester)).toHaveAttribute("aria-selected", "true");
        expect(tab(t.tabs.carrier)).toHaveAttribute("aria-selected", "false");
        expect(await screen.findByText("INV-2026-0001")).toBeInTheDocument();
        // The carrier's ledger is not read until its tab is open.
        expect(urlsFetched().some((url) => url.startsWith("/api/carrier"))).toBe(false);
    });

    it("opens the carrier's statement when the URL asks for it", async () => {
        nav.params.set("tab", "carrier");
        renderHistory();

        expect(tab(t.tabs.carrier)).toHaveAttribute("aria-selected", "true");
        expect(await screen.findByText("Palette Lyon → Paris")).toBeInTheDocument();
    });

    it("treats an unknown tab as the default", async () => {
        nav.params.set("tab", "everything");
        renderHistory();

        expect(tab(t.tabs.requester)).toHaveAttribute("aria-selected", "true");
    });

    it("writes the chosen tab into the URL", () => {
        renderHistory();

        fireEvent.mouseDown(tab(t.tabs.carrier)!, { button: 0 });

        expect(nav.replace).toHaveBeenCalledWith("/profile/invoices?tab=carrier", {
            scroll: false,
        });
    });

    it("shows no carrier tab to an account without the role", async () => {
        nav.roles = { data: ["shipper"], isLoading: false };
        renderHistory();

        expect(await screen.findByText("INV-2026-0001")).toBeInTheDocument();
        expect(tab(t.tabs.carrier)).not.toBeInTheDocument();
        // Nor a strip holding a single tab: one side means no control.
        expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    });

    it("lands a `?tab=carrier` link on the documents when the role is missing", async () => {
        nav.roles = { data: ["shipper"], isLoading: false };
        nav.params.set("tab", "carrier");
        renderHistory();

        expect(await screen.findByText("INV-2026-0001")).toBeInTheDocument();
        expect(tab(t.tabs.carrier)).not.toBeInTheDocument();
        expect(urlsFetched().some((url) => url.startsWith("/api/carrier"))).toBe(false);
    });

    it("falls back to the documents when the roles cannot be read", async () => {
        nav.roles = { data: undefined, isLoading: false };
        nav.params.set("tab", "carrier");
        renderHistory();

        expect(await screen.findByText("INV-2026-0001")).toBeInTheDocument();
        expect(tab(t.tabs.carrier)).not.toBeInTheDocument();
    });

    it("holds a carrier link while the roles load, rather than flashing the documents", () => {
        nav.roles = { data: undefined, isLoading: true };
        nav.params.set("tab", "carrier");
        renderHistory();

        expect(screen.getByTestId("inline-loader")).toBeInTheDocument();
        expect(urlsFetched()).toEqual([]);
    });

    it("renders the requester's tab in French with no missing key", async () => {
        server.invoices = [
            invoice(),
            invoice({ id: "inv-2", invoiceNumber: "INV-2026-0002", documentType: "invoice" }),
            invoice({
                id: "cn-1",
                invoiceNumber: "AV-2026-0001",
                kind: "credit_note",
                documentType: "credit_note",
                amount: -18_000,
                relatedInvoiceNumber: "INV-2026-0001",
            }),
        ];
        const onError = renderHistory("fr");

        await screen.findByText("AV-2026-0001");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Historique des transactions"
        );
        expect(tab(fr.profile.invoices.tabs.requester)).toHaveAttribute("aria-selected", "true");
        expect(tab(fr.profile.invoices.tabs.carrier)).toBeInTheDocument();
        expect(onError).not.toHaveBeenCalled();
    });

    it("renders the carrier's tab in French with no missing key", async () => {
        // Every payout state the enum holds, plus none at all: the label is
        // reached by template, so only a render proves each one exists.
        server.earnings = ["scheduled", "processing", "paid", "failed", "cancelled", null].map(
            (payoutStatus, index) =>
                earningsItem({ shipmentId: `ship-${index}`, payoutStatus })
        );
        nav.params.set("tab", "carrier");
        const onError = renderHistory("fr");

        expect(await screen.findByText("Total — 6 livraisons")).toBeInTheDocument();
        expect(tab(fr.profile.invoices.tabs.carrier)).toHaveAttribute("aria-selected", "true");
        expect(screen.getByText(fr.profile.invoices.carrier.payout.none)).toBeInTheDocument();
        expect(onError).not.toHaveBeenCalled();
    });
});

// ========================================
// The requester's tab
// ========================================

describe("TransactionHistory — the requester's documents", () => {
    beforeEach(() => {
        server.invoices = [
            invoice(),
            invoice({
                id: "inv-2",
                invoiceNumber: "INV-2026-0002",
                documentType: "invoice",
            }),
            invoice({
                id: "cn-1",
                invoiceNumber: "AV-2026-0001",
                kind: "credit_note",
                documentType: "credit_note",
                amount: -18_000,
                relatedInvoiceId: "inv-1",
                relatedInvoiceNumber: "INV-2026-0001",
            }),
        ];
    });

    const rowOf = async (number: string) =>
        (await screen.findByText(number)).closest("tr") as HTMLElement;

    it("labels each row with what its document calls itself", async () => {
        renderHistory();

        expect(within(await rowOf("INV-2026-0002")).getByText(t.documentType.invoice)).toBeInTheDocument();
        expect(within(await rowOf("AV-2026-0001")).getByText(t.documentType.credit_note)).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: t.columns.type })).toBeInTheDocument();
    });

    it("uses the words the PDF prints, in French", async () => {
        renderHistory("fr");

        // INV-2026-0001 appears twice: its own row, and the avoir's badge.
        const receipt = (await screen.findAllByText("INV-2026-0001"))[0].closest("tr")!;
        expect(within(receipt as HTMLElement).getByText("Reçu de paiement")).toBeInTheDocument();
        expect(within(await rowOf("INV-2026-0002")).getByText("Facture")).toBeInTheDocument();
        expect(within(await rowOf("AV-2026-0001")).getByText("Avoir")).toBeInTheDocument();
    });

    it("names the document an avoir corrects", async () => {
        renderHistory();

        expect(
            within(await rowOf("AV-2026-0001")).getByText("Credit note for INV-2026-0001")
        ).toBeInTheDocument();
    });

    it("keeps its own failure state, with a retry", async () => {
        server.invoicesFail = true;
        renderHistory();

        expect(await screen.findByText(t.error)).toBeInTheDocument();
        server.invoicesFail = false;
        fireEvent.click(screen.getByRole("button", { name: t.retry }));

        expect(await screen.findByText("INV-2026-0001")).toBeInTheDocument();
    });

    it("reads as empty, not as a failure, when nothing was charged", async () => {
        server.invoices = [];
        renderHistory();

        expect(await screen.findByText(t.empty)).toBeInTheDocument();
        expect(screen.queryByText(t.error)).not.toBeInTheDocument();
    });
});

// ========================================
// The carrier's tab
// ========================================

describe("TransactionHistory — the carrier's statement", () => {
    beforeEach(() => {
        nav.params.set("tab", "carrier");
    });

    const c = t.carrier;
    const statementLink = () => screen.getByRole("link", { name: c.downloadStatement });

    it("prints one statement line per delivered run", async () => {
        renderHistory();

        const row = (await screen.findByText("Palette Lyon → Paris")).closest("tr")!;
        const cells = within(row as HTMLElement);
        expect(cells.getByRole("link", { name: "Palette Lyon → Paris" })).toHaveAttribute(
            "href",
            "/deliveries/ship-1"
        );
        expect(cells.getByText("03/09/2026")).toBeInTheDocument();
        expect(cells.getByText("100042")).toBeInTheDocument();
        expect(cells.getByText("200,00 €")).toBeInTheDocument();
        expect(cells.getByText("20,00 €")).toBeInTheDocument();
        expect(cells.getByText("180,00 €")).toBeInTheDocument();
        expect(cells.getByText(c.payout.scheduled)).toBeInTheDocument();
    });

    it("says when a run carries no payout, rather than leaving the cell blank", async () => {
        server.earnings = [earningsItem({ payoutStatus: null, netCents: 0 })];
        renderHistory();

        expect(await screen.findByText(c.payout.none)).toBeInTheDocument();
    });

    it("totals the period from the server's summary", async () => {
        server.earnings = [earningsItem(), earningsItem({ shipmentId: "ship-2", reference: "100043" })];
        renderHistory();

        expect(await screen.findByText("Total — 2 deliveries")).toBeInTheDocument();
        expect(screen.getByText("360,00 €")).toBeInTheDocument();
    });

    it("says so when the list stops at the page ceiling", async () => {
        server.earningsTotal = 140;
        renderHistory();

        expect(
            await screen.findByText(/Only the 1 most recent of 140 transports are shown/)
        ).toBeInTheDocument();
    });

    it("reads as empty, not as a failure, when nothing was delivered", async () => {
        server.earnings = [];
        renderHistory();

        expect(await screen.findByText(c.empty)).toBeInTheDocument();
        expect(screen.queryByText(c.error)).not.toBeInTheDocument();
        // An empty period is exactly when the period has to change.
        expect(statementLink()).toBeInTheDocument();
    });

    it("keeps its own failure state, with a retry", async () => {
        server.earningsFail = true;
        renderHistory();

        expect(await screen.findByText(c.error)).toBeInTheDocument();
        expect(screen.queryByText(t.error)).not.toBeInTheDocument();

        server.earningsFail = false;
        fireEvent.click(screen.getByRole("button", { name: t.retry }));

        expect(await screen.findByText("Palette Lyon → Paris")).toBeInTheDocument();
    });

    // A carrier role with no carrier file yet has carried nothing (2.63.0
    // browser pass): empty, not a failure.
    it("reads a carrier with no file yet as empty, not failed", async () => {
        server.earningsNoCarrier = true;
        renderHistory();

        expect(await screen.findByText(c.empty)).toBeInTheDocument();
        expect(screen.queryByText(c.error)).not.toBeInTheDocument();
    });

    it("links the relevé for the period on screen", async () => {
        renderHistory();
        await screen.findByText("Palette Lyon → Paris");

        expect(statementLink()).toHaveAttribute("href", "/api/carrier/earnings/statement");

        // Radix Select's typeahead: « T » is « This month ».
        fireEvent.keyDown(screen.getByRole("combobox"), { key: "T" });

        const { from, to } = periodBoundsIso("this_month");
        const query = new URLSearchParams({ from: from!, to: to! }).toString();
        await waitFor(() =>
            expect(statementLink()).toHaveAttribute(
                "href",
                `/api/carrier/earnings/statement?${query}`
            )
        );
        // And the lines on screen are read for that same period.
        await waitFor(() =>
            expect(
                urlsFetched().some(
                    (url) =>
                        url.startsWith("/api/carrier/earnings?") &&
                        url.includes(`from=${encodeURIComponent(from!)}`)
                )
            ).toBe(true)
        );
    });
});
