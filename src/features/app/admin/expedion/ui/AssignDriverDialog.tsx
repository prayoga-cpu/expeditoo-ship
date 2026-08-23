"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { QuoteRow } from "@/server/dal/expedion-report.dal";

import { formatCurrency } from "@/lib/currency";

import {
  useCarrierOptions,
  useExpedionAssignDriver,
} from "../hooks/useExpedionReport";

/**
 * Assigns a carrier from the pool — the concierge half of the model, where an
 * operator picks rather than the job going out to bid.
 *
 * This posts to `/assign`, which runs the same award machinery the
 * marketplace uses: a listing, an offer at the price the client already paid,
 * a shipment and a payment hold. The older shape — a `PATCH` setting
 * `assignedCarrierId` — only wrote the column, so the driver never saw the job
 * and nothing could carry it to `delivered`.
 *
 * Assigning is also what stops the escalation timer picking the quote up: it
 * leaves with a listing behind it, and `findDueForEscalation` skips those.
 */
export function AssignDriverDialog({
  quote,
  onClose,
}: {
  quote: QuoteRow | null;
  onClose: () => void;
}) {
  const [carrierId, setCarrierId] = useState<string>("");
  const { data: carriers = [], isLoading } = useCarrierOptions();
  const { mutate, isPending } = useExpedionAssignDriver();
  const t = useTranslations("admin.expedion");

  useEffect(() => {
    if (quote) setCarrierId("");
  }, [quote]);

  function save() {
    if (!quote || !carrierId) return;
    mutate({ id: quote.id, carrierId }, { onSuccess: onClose });
  }

  return (
    <Dialog open={quote !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("actions.assignTitle")}</DialogTitle>
          <DialogDescription>
            {t("actions.assignBody", {
              reference: quote?.reference ?? quote?.id.slice(0, 8) ?? "",
              city: quote?.deliveryCity ?? "—",
              // What the driver will be paid against, and what is already
              // held — stated here because this dialog is the last step
              // before money moves.
              price:
                quote?.priceCents != null
                  ? formatCurrency(quote.priceCents, { fractionDigits: 0 })
                  : "—",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="assign-carrier">{t("actions.carrier")}</Label>
          <Select value={carrierId} onValueChange={setCarrierId}>
            <SelectTrigger id="assign-carrier">
              <SelectValue
                placeholder={
                  isLoading
                    ? t("actions.loading")
                    : t("actions.chooseCarrier")
                }
              />
            </SelectTrigger>
            <SelectContent>
              {carriers.map((carrier) => (
                <SelectItem key={carrier.id} value={carrier.id}>
                  {carrier.companyName ?? carrier.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isLoading && carriers.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              {t("actions.noCarriers")}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {t("actions.cancel")}
          </Button>
          <Button onClick={save} disabled={!carrierId || isPending}>
            {isPending ? t("actions.assigning") : t("actions.assignConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
