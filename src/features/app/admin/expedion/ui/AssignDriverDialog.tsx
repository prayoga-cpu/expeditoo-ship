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

import {
  useCarrierOptions,
  useExpedionQuoteAdmin,
} from "../hooks/useExpedionReport";

/**
 * Assigns a carrier from the pool — the concierge half of the model, where an
 * operator picks rather than the job going out to bid.
 *
 * Assigning is what takes a quote out of the "no driver" queue, and it is also
 * what stops the escalation timer picking it up: `findDueForEscalation` skips
 * anything with an `assigned_carrier_id`.
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
  const { mutate, isPending } = useExpedionQuoteAdmin();
  const t = useTranslations("admin.expedion");

  useEffect(() => {
    if (quote) setCarrierId("");
  }, [quote]);

  function save() {
    if (!quote || !carrierId) return;
    mutate(
      {
        id: quote.id,
        patch: {
          assignedCarrierId: carrierId,
          // A timeline entry, not UI — kept in the log's own language. Same
          // reasoning as the note in RepriceDialog.
          note: "Chauffeur attribué depuis la supervision",
        },
      },
      { onSuccess: onClose }
    );
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
