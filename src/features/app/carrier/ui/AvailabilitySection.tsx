"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { LogOut, Plane, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isAbsent } from "@/lib/carrier-availability";
import {
  addDaysLocalISO,
  parseLocalISO,
  todayLocalISO,
} from "@/lib/utils/date-range";
import { useDeregister, useSetAvailability } from "../hooks/useCarrier";
import type { CarrierApplication } from "../api/carrier.api";

/**
 * « Disponibilité » on an approved driver's own file
 * (client_feedback_2026_10_29_spec.md §REQ-02): step away for a while — with
 * a return date, or until they say so — or leave the platform.
 *
 * Away keeps everything: runs already booked, money owed, documents. It only
 * stops new work reaching them, and the copy says so, because « absent » read
 * on its own sounds like losing a job already won.
 */
export function AvailabilitySection({
  application,
}: {
  application: CarrierApplication;
}) {
  const t = useTranslations("carrier.application.availability");
  const format = useFormatter();
  const setAvailability = useSetAvailability();
  const deregister = useDeregister();
  const [mode, setMode] = useState<"idle" | "absent" | "deregister">("idle");
  const [returnDay, setReturnDay] = useState("");
  const [reason, setReason] = useState("");
  const absent = isAbsent(application);

  const reset = () => {
    setMode("idle");
    setReturnDay("");
    setReason("");
  };

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <div>
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {absent
            ? application.absentUntil
              ? t("absentUntil", {
                  date: format.dateTime(new Date(application.absentUntil), {
                    day: "numeric",
                    month: "long",
                  }),
                })
              : t("absentOpenEnded")
            : t("active")}
        </p>
      </div>

      {mode === "absent" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="absence-return-day">
              {t("returnDayLabel")}
            </label>
            <Input
              id="absence-return-day"
              type="date"
              min={addDaysLocalISO(todayLocalISO(), 1)}
              value={returnDay}
              onChange={(event) => setReturnDay(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("returnDayHint")}</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="absence-reason">
              {t("reasonLabel")}
            </label>
            <Textarea
              id="absence-reason"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("absentKeeps")}</p>
        </div>
      )}

      {mode === "deregister" && (
        <div className="space-y-3">
          <p className="text-sm">{t("deregisterWarning")}</p>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="deregister-reason">
              {t("deregisterReasonLabel")}
            </label>
            <Textarea
              id="deregister-reason"
              rows={2}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {mode === "idle" ? (
          <>
            <Button variant="ghost" onClick={() => setMode("deregister")}>
              <LogOut className="mr-1.5 h-4 w-4" />
              {t("deregister")}
            </Button>
            {absent ? (
              <Button
                disabled={setAvailability.isPending}
                onClick={() => setAvailability.mutate({ absent: false })}
              >
                <UserCheck className="mr-1.5 h-4 w-4" />
                {t("back")}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setMode("absent")}>
                <Plane className="mr-1.5 h-4 w-4" />
                {t("goAway")}
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="outline" onClick={reset}>
              {t("cancel")}
            </Button>
            {mode === "absent" ? (
              <Button
                disabled={setAvailability.isPending}
                onClick={() =>
                  setAvailability.mutate(
                    {
                      absent: true,
                      until: returnDay
                        ? parseLocalISO(returnDay).toISOString()
                        : null,
                      reason: reason.trim() || null,
                    },
                    { onSuccess: reset }
                  )
                }
              >
                {t("confirmAway")}
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={deregister.isPending}
                onClick={() =>
                  deregister.mutate(reason.trim() || null, { onSuccess: reset })
                }
              >
                {t("confirmDeregister")}
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
