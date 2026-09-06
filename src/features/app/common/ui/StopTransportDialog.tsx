"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  categoriesForSide,
  type CancellationCategory,
  type CancellationSide,
} from "@/lib/cancellation-policy";

/** Matches the DTO's floor, and the server's (`reason` is `min(3)`). */
const MIN_REASON = 3;

interface StopTransportDialogProps {
  /**
   * Which half of the feature this is. It picks the categories, the wording and
   * the button colour — the requester ends the job, the transporter only comes
   * off it, and the copy must not let either think they are doing the other.
   */
  side: Extract<CancellationSide, "requester" | "transporter">;
  onConfirm: (input: {
    category: CancellationCategory;
    reason?: string;
  }) => Promise<unknown>;
  isPending: boolean;
  disabled?: boolean;
  /**
   * Controlled open state. Uncontrolled by default; a caller passing this
   * drives the dialog itself, which is also how it is rendered open in tests
   * (jsdom will not carry a Radix trigger click through the portal).
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * One dialog, both sides.
 *
 * There were two cancellability rules in the browser before this and neither
 * was the server's; worse, a self-assigned carrier resolved to "carrier" on the
 * client's delivery screen and was shown the *client's* cancel button, so one
 * component now serves both surfaces and takes the side as an input.
 *
 * The requester's trigger is `destructive` and the transporter's is `outline`.
 * That is not decoration: `ReportIncidentDialog` reserves the red slot for
 * ending a transport precisely so two red buttons never sit side by side, and a
 * withdrawal does not end the client's transport at all.
 *
 * The dialog stays open until the mutation resolves. Before this it closed on
 * click, so a refusal — `CANCEL_REQUIRES_SUPPORT` above all — survived only as
 * a toast over a screen that already looked as though it had worked.
 */
export function StopTransportDialog({
  side,
  onConfirm,
  isPending,
  disabled = false,
  open: controlledOpen,
  onOpenChange,
}: StopTransportDialogProps) {
  const t = useTranslations("shipments.stop");
  const categories = categoriesForSide(side);

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const [category, setCategory] = useState<CancellationCategory>(categories[0]);
  const [reason, setReason] = useState("");

  const canSubmit = reason.trim().length >= MIN_REASON && !isPending;

  const submit = async () => {
    try {
      await onConfirm({ category, reason: reason.trim() });
      setOpen(false);
      setReason("");
      setCategory(categories[0]);
    } catch {
      // The mutation's own onError has already said what went wrong. Staying
      // open is the point: the reason typed is not lost to a refusal.
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={side === "requester" ? "destructive" : "outline"}
          className="w-full gap-2"
          disabled={disabled}
        >
          {t(`${side}.trigger`)}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(`${side}.title`)}</DialogTitle>
          <DialogDescription>{t(`${side}.description`)}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="stop-category">{t("categoryLabel")}</Label>
            <Select
              value={category}
              onValueChange={(next) =>
                setCategory(next as CancellationCategory)
              }
            >
              <SelectTrigger id="stop-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`categories.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stop-reason">{t("reasonLabel")}</Label>
            <Textarea
              id="stop-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t(`${side}.reasonPlaceholder`)}
              rows={3}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {t("keep")}
          </Button>
          <Button
            variant={side === "requester" ? "destructive" : "default"}
            onClick={submit}
            disabled={!canSubmit}
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {isPending ? t("submitting") : t(`${side}.confirm`)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
