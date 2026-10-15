"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InlineLoader } from "@/components/ui/page-loader";
import { useUserRoles } from "../../hooks/useUserRoles";
import { CarrierStatementPanel } from "./CarrierStatementPanel";
import { InvoiceList } from "./InvoiceList";

type TransactionTab = "requester" | "carrier";

/**
 * « Historique des transactions » — what money produced, for each side of the
 * platform a person can be on: the requester's receipts, invoices and avoirs,
 * and the carrier's statement lines (client_feedback_2026_10_spec.md §7a).
 *
 * The route stays `/profile/invoices`, because every receipt already emailed
 * links there. The tab lives in `?tab=` like `/carrier/trips` and
 * `/listings/me`, so a reload and a shared link land where the person was.
 *
 * The carrier tab exists only for an account holding `carrier`, read the way
 * the profile's own quick links read it. The earnings route refuses everyone
 * else anyway; this only spares them a tab that could never load.
 */
export function TransactionHistory() {
    const t = useTranslations("profile.invoices");
    const router = useRouter();
    const params = useSearchParams();
    const { data: roles, isLoading: rolesLoading } = useUserRoles();

    const isCarrier = roles?.includes("carrier") ?? false;
    const askedForCarrier = params.get("tab") === "carrier";

    const select = (next: string) => {
        const query = new URLSearchParams(params.toString());
        query.set("tab", next);
        router.replace(`/profile/invoices?${query.toString()}`, { scroll: false });
    };

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

            {askedForCarrier && rolesLoading ? (
                // A carrier's link waits for the roles rather than flashing
                // the requester's documents and then swapping them out.
                <div className="flex justify-center py-12">
                    <InlineLoader size="md" />
                </div>
            ) : isCarrier ? (
                <TransactionTabs
                    tab={askedForCarrier ? "carrier" : "requester"}
                    onSelect={select}
                />
            ) : (
                // One side only. A strip holding a single tab is a control
                // that does nothing, and a tab panel with no tab is not one.
                // A `?tab=carrier` link lands here too, on the documents.
                <InvoiceList />
            )}
        </div>
    );
}

function TransactionTabs({
    tab,
    onSelect,
}: {
    tab: TransactionTab;
    onSelect: (tab: string) => void;
}) {
    const t = useTranslations("profile.invoices.tabs");

    return (
        <Tabs value={tab} onValueChange={onSelect}>
            <TabsList className="w-full md:w-auto">
                <TabsTrigger value="requester" className="flex-1 md:flex-none">
                    {t("requester")}
                </TabsTrigger>
                <TabsTrigger value="carrier" className="flex-1 md:flex-none">
                    {t("carrier")}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="requester" className="pt-2">
                <InvoiceList />
            </TabsContent>

            <TabsContent value="carrier" className="pt-2">
                <CarrierStatementPanel />
            </TabsContent>
        </Tabs>
    );
}
