"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/page-loader";
import {
  usePlatformSettings,
  useUpdatePlatformSettings,
} from "../hooks/usePlatformSettings";

/** Basis points <-> the percentage an admin actually thinks in. */
const toPercent = (basisPoints: number) => basisPoints / 100;
const toBasisPoints = (percent: number) => Math.round(percent * 100);

/**
 * The one platform-economics knob an admin can turn: a fee added on top of
 * what the client is charged at award time. Distinct from the carrier-side
 * commission, which this page does not touch.
 */
export function PlatformSettingsPanel() {
  const t = useTranslations("platformSettings");
  const format = useFormatter();
  const { data, isLoading } = usePlatformSettings();
  const update = useUpdatePlatformSettings();
  const [percent, setPercent] = useState("0");

  useEffect(() => {
    if (data) setPercent(String(toPercent(data.feeBasisPoints)));
  }, [data]);

  if (isLoading) return <PageLoader />;

  const handleSave = () => {
    const parsed = Number(percent);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return;
    update.mutate({ feeBasisPoints: toBasisPoints(parsed) });
  };

  return (
    <div className="mx-auto w-full max-w-xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card className="p-5">
        <Label htmlFor="feePercent">{t("feeLabel")}</Label>
        <div className="relative mt-1 max-w-[160px]">
          <Input
            id="feePercent"
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className="pr-8"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
            %
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("feeHint")}</p>

        <Button
          type="button"
          className="mt-4"
          onClick={handleSave}
          disabled={update.isPending}
        >
          {update.isPending ? t("saving") : t("save")}
        </Button>

        {data?.updatedAt && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("lastChanged", {
              date: format.dateTime(new Date(data.updatedAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
        )}
      </Card>
    </div>
  );
}
