"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlannedTripsPanel } from "./PlannedTripsPanel";
import { PendingOffersPanel } from "./PendingOffersPanel";
import { ActiveTripsPanel } from "./ActiveTripsPanel";
import { CompletedTripsPanel } from "./CompletedTripsPanel";

/** In the order the client listed them (client_feedback_2026_10_spec.md §5). */
const TRIP_TABS = ["planned", "pending", "active", "completed"] as const;

type TripTab = (typeof TRIP_TABS)[number];

/** A typo, a stale link or a tab that no longer exists lands on the default. */
const tabFrom = (value: string | null): TripTab =>
  TRIP_TABS.find((tab) => tab === value) ?? "planned";

/**
 * The client asked for one screen with the routes a carrier declares and the
 * transports they carried out, then for the bids still awaiting an answer and
 * the runs on the road between the two.
 *
 * The tab lives in the URL rather than in state so a reload, a back button and
 * a shared link all land where the carrier was — `?tab=completed` included,
 * which links from before the four tabs still carry.
 */
export function CarrierTripsScreen() {
  const t = useTranslations("carrier.trips");
  const tShipments = useTranslations("driver.shipments");
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const tab = tabFrom(params.get("tab"));

  const select = (next: string) => {
    const query = new URLSearchParams(params.toString());
    query.set("tab", next);
    router.replace(`/carrier/trips?${query.toString()}`, { scroll: false });
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground">{t("pageSubtitle")}</p>
        </div>
        {/* « Mes paiements » from the deliveries screen (§N5 of the 29
            October spec) — carriers only: a driver-only account is never
            shown pay. */}
        {user?.roles?.includes("carrier") && (
          <Button variant="secondary" asChild>
            <Link href="/carrier/withdrawals">
              <Wallet className="h-4 w-4" aria-hidden />
              {tShipments("myPayments")}
            </Link>
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={select} className="flex flex-1 flex-col">
        <TripTabsList />

        <TabsContent value="planned" className="flex flex-1 flex-col pt-4">
          <PlannedTripsPanel />
        </TabsContent>

        <TabsContent value="pending" className="flex flex-1 flex-col pt-4">
          <PendingOffersPanel />
        </TabsContent>

        <TabsContent value="active" className="flex flex-1 flex-col pt-4">
          <ActiveTripsPanel />
        </TabsContent>

        <TabsContent value="completed" className="flex flex-1 flex-col pt-4">
          <CompletedTripsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Two by two on a phone: four labels, one of them « En attente de réponse »,
 * do not fit on one line at 360px.
 */
function TripTabsList() {
  const t = useTranslations("carrier.trips.tabs");

  return (
    <TabsList className="grid h-auto w-full grid-cols-2 gap-[3px] md:inline-flex md:h-9 md:w-auto">
      {TRIP_TABS.map((value) => (
        <TabsTrigger
          key={value}
          value={value}
          className="min-h-8 whitespace-normal leading-tight md:flex-none md:whitespace-nowrap"
        >
          {t(value)}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
