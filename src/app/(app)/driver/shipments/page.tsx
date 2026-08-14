"use client";

import { MyShipments } from "@/features/app/driver/ui/MyShipments";
import { useTranslations } from "next-intl";

export default function DriverShipmentsPage() {
  const t = useTranslations("driver.shipments");

  return (
    <div className="flex flex-col h-full gap-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <MyShipments />
    </div>
  );
}
