"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pin } from "lucide-react";
import { useTranslations } from "next-intl";

export function LandingHeroForm() {
  const t = useTranslations("marketing.hero.form");

  return (
    <div className="bg-card p-6 rounded-lg shadow-lg border border-border">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-foreground">{t("from")}</label>
          <div className="relative">
            <Pin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input placeholder={t("placeholder")} className="pl-10" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">{t("to")}</label>
          <div className="relative">
            <Pin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input placeholder={t("placeholder")} className="pl-10" />
          </div>
        </div>
      </div>
      <Button className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground">
        {t("cta")}
      </Button>
    </div>
  );
}