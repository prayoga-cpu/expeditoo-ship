"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlannedTripsPanel } from "./PlannedTripsPanel";
import { CompletedTripsPanel } from "./CompletedTripsPanel";

type TripTab = "planned" | "completed";

/**
 * The client asked for two sections and said they could be mixed in one
 * screen, so they are: the routes a carrier declares, and the transports they
 * actually carried out.
 *
 * The tab lives in the URL rather than in state so a reload, a back button and
 * a shared link all land where the carrier was.
 */
export function CarrierTripsScreen() {
  const t = useTranslations("carrier.trips");
  const router = useRouter();
  const params = useSearchParams();

  const tab: TripTab = params.get("tab") === "completed" ? "completed" : "planned";

  const select = (next: string) => {
    const query = new URLSearchParams(params.toString());
    query.set("tab", next);
    router.replace(`/carrier/trips?${query.toString()}`, { scroll: false });
  };

  return (
    <div className="flex h-full flex-col gap-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground">{t("pageSubtitle")}</p>
      </div>

      <Tabs value={tab} onValueChange={select} className="flex flex-1 flex-col">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="planned" className="flex-1 md:flex-none">
            {t("tabs.planned")}
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1 md:flex-none">
            {t("tabs.completed")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planned" className="flex flex-1 flex-col pt-4">
          <PlannedTripsPanel />
        </TabsContent>

        <TabsContent value="completed" className="flex flex-1 flex-col pt-4">
          <CompletedTripsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
