"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MyRequestsPanel } from "./MyRequestsPanel";
import { DeliveryHistoryPanel } from "./DeliveryHistoryPanel";

type RequestTab = "requests" | "history";

/**
 * The requester's side of the screen the carrier already has at
 * `/carrier/trips`: what is in flight, and what was carried out.
 *
 * The tab lives in the URL rather than in state so a reload, a back button and
 * a shared link all land where the requester was.
 */
export function MyRequestsScreen() {
  const t = useTranslations("myJobs");
  const router = useRouter();
  const params = useSearchParams();

  const tab: RequestTab =
    params.get("tab") === "history" ? "history" : "requests";

  const select = (next: string) => {
    const query = new URLSearchParams(params.toString());
    query.set("tab", next);
    router.replace(`/listings/me?${query.toString()}`, { scroll: false });
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      <Tabs value={tab} onValueChange={select}>
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="requests" className="flex-1 md:flex-none">
            {t("tabs.requests")}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 md:flex-none">
            {t("tabs.history")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="pt-4">
          <MyRequestsPanel />
        </TabsContent>

        <TabsContent value="history" className="pt-4">
          <DeliveryHistoryPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
