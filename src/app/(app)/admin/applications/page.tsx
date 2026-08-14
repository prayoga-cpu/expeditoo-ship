"use client";

import { CarrierApplicationsList } from "@/features/app/admin/ui/CarrierApplicationsList";
import { Truck } from "lucide-react";
import { useTranslations } from "next-intl";

export default function CarrierApplicationsPage() {
  const t = useTranslations("admin.carriers");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Truck className="w-8 h-8 text-primary" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <CarrierApplicationsList />
    </div>
  );
}
