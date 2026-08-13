"use client";

import { ShipmentProposals } from "@/features/app/driver/ui/ShipmentProposals";
import { MyShipments } from "@/features/app/driver/ui/MyShipments";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDriverShipments } from "@/features/app/driver/hooks/useDriverShipments";
import { PageLoader } from "@/components/ui/page-loader";
import { useTranslations } from "next-intl";

export default function DriverShipmentsPage() {
  const { isLoading } = useDriverShipments();
  const t = useTranslations("driver.shipments");

  if (isLoading) {
    return <PageLoader variant="driver" />;
  }

  return (
    <div className="flex flex-col h-full gap-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Tabs defaultValue="available" className="w-full flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="available">{t("tabs.available")}</TabsTrigger>
          <TabsTrigger value="my-shipments">
            {t("tabs.myShipments")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="available" className="flex-1 flex flex-col mt-6 data-[state=inactive]:hidden">
          <ShipmentProposals />
        </TabsContent>
        <TabsContent value="my-shipments" className="flex-1 flex flex-col mt-6 data-[state=inactive]:hidden">
          <MyShipments />
        </TabsContent>
      </Tabs>
    </div>
  );
}
