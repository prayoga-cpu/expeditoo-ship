"use client";

import { useRef, useState } from "react";
import { AlertTriangle, ImagePlus, Loader2, X } from "lucide-react";
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
import { toast } from "sonner";
import {
  uploadIncidentPhoto,
  type IncidentCategory,
  type IncidentSeverity,
} from "../api/incidents.api";
import { useReportIncident } from "../hooks/useIncidents";

/** Mirrors the DTO. Kept in declaration order so the list reads worst-first. */
const CATEGORIES: IncidentCategory[] = [
  "damage",
  "delay",
  "access",
  "vehicle",
  "cargo_mismatch",
  "safety",
  "other",
];

const SEVERITIES: IncidentSeverity[] = ["low", "medium", "high"];

/** Matches `MAX_INCIDENT_PHOTOS` server-side. */
const MAX_PHOTOS = 6;
const MIN_DESCRIPTION = 10;

interface ReportIncidentDialogProps {
  shipmentId: string;
  /** Hidden once the run is over — the server refuses it anyway (§2.1). */
  disabled?: boolean;
  className?: string;
  /**
   * Controlled open state. Uncontrolled by default; a caller passing this
   * drives the dialog itself, which is also how it is rendered open in tests
   * (jsdom will not carry a Radix trigger click through the portal).
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * "Something has gone wrong" — the one button both the client and the
 * transporter get, and the same component on both surfaces so the two never
 * drift apart.
 *
 * The trigger is `outline`, not `destructive`. Cancelling a shipment is
 * destructive; reporting a problem is not, and two red buttons side by side
 * teach people to avoid both.
 */
export function ReportIncidentDialog({
  shipmentId,
  disabled = false,
  className,
  open: controlledOpen,
  onOpenChange,
}: ReportIncidentDialogProps) {
  const t = useTranslations("incidents");
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [category, setCategory] = useState<IncidentCategory>("delay");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [description, setDescription] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const report = useReportIncident(shipmentId);
  const canSubmit =
    description.trim().length >= MIN_DESCRIPTION &&
    !report.isPending &&
    !isUploading;

  const reset = () => {
    setCategory("delay");
    setSeverity("medium");
    setDescription("");
    setPhotoUrls([]);
  };

  const handlePick = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - photoUrls.length;
    if (room <= 0) return;

    setIsUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of Array.from(files).slice(0, room)) {
        uploaded.push(await uploadIncidentPhoto(file));
      }
    } catch {
      toast.error(t("photos.uploadError"));
    } finally {
      // Anything that made it is kept: re-picking every photo because the last
      // one failed is a worse answer than a partial set.
      if (uploaded.length) setPhotoUrls((prev) => [...prev, ...uploaded]);
      setIsUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    report.mutate(
      {
        category,
        severity,
        description: description.trim(),
        photoUrls,
      },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`gap-2 ${className ?? ""}`}
          disabled={disabled}
        >
          <AlertTriangle className="h-4 w-4" />
          {t("report.trigger")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("report.title")}</DialogTitle>
          <DialogDescription>{t("report.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="incident-category">
                {t("fields.category")}
              </Label>
              <Select
                value={category}
                onValueChange={(value) =>
                  setCategory(value as IncidentCategory)
                }
              >
                <SelectTrigger id="incident-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`categories.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident-severity">
                {t("fields.severity")}
              </Label>
              <Select
                value={severity}
                onValueChange={(value) =>
                  setSeverity(value as IncidentSeverity)
                }
              >
                <SelectTrigger id="incident-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`severities.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="incident-description">
              {t("fields.description")}
            </Label>
            <Textarea
              id="incident-description"
              rows={4}
              placeholder={t("fields.descriptionPlaceholder")}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("fields.descriptionHint", { min: MIN_DESCRIPTION })}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t("photos.label")}</Label>
            <div className="flex flex-wrap gap-2">
              {photoUrls.map((url) => (
                <div key={url} className="relative">
                  <img
                    src={url}
                    alt=""
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                  <button
                    type="button"
                    aria-label={t("photos.remove")}
                    onClick={() =>
                      setPhotoUrls((prev) => prev.filter((it) => it !== url))
                    }
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 text-muted-foreground shadow ring-1 ring-border hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {photoUrls.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={isUploading}
                  className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(event) => handlePick(event.target.files)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={report.isPending}
          >
            {t("report.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {report.isPending ? t("report.submitting") : t("report.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
