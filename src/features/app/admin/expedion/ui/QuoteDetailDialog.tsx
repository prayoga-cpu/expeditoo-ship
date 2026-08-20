"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
  Pencil,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LocationPickerField,
  type LocationPickerValue,
} from "@/components/ui/location-picker-field";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/currency";
import { draftEscalationBlockers } from "../lib/quote-action";
import {
  useExpedionEscalate,
  useExpedionQuoteAdmin,
  useExpedionQuoteDetail,
  useExpedionReextract,
  type QuoteAdminPatch,
  type QuoteDetail,
} from "../hooks/useExpedionReport";

/**
 * Everything the platform holds about one quote, including the slip the client
 * uploaded.
 *
 * The report's tables are deliberately narrow — a worklist has to stay
 * scannable — so this is where an operator goes to answer "what actually is
 * this job?" before pricing it. The bordereau matters most: the price comes off
 * what is written on it, and until now the only way to see it was a database
 * client.
 *
 * Saves go through the admin endpoint (`useExpedionQuoteAdmin`) rather than
 * the client's own confirm-details route: this dialog only ever renders on
 * `/admin/expedion`, an admin-only page, and the admin route is the one that
 * logs an audited event per change — and the only one that accepts
 * coordinates and the accepted price, which a client is never allowed to set
 * on their own quote.
 */

function isPreviewable(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Whether to render a document inline as an image or as an embedded PDF.
 *
 * Firebase Storage URLs carry the filename in an encoded path and a query
 * string after it, so the extension is looked for in the whole URL rather than
 * at its end. An unrecognised type falls back to the PDF frame, which browsers
 * degrade to a download prompt rather than a broken image.
 */
function looksLikeImage(url: string): boolean {
  return /\.(png|jpe?g|gif|webp|heic|avif)(\?|$|%3f)/i.test(url);
}

function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

/** Seeds the edit form from whatever the server currently holds. */
function buildEditForm(d: QuoteDetail): QuoteAdminPatch {
  return {
    firstName: d.firstName,
    lastName: d.lastName,
    email: d.email,
    phone: d.phone,
    clientAddress: d.clientAddress,
    clientPostalCode: d.clientPostalCode,
    clientCity: d.clientCity,
    clientCountry: d.clientCountry,
    auctionHouseName: d.auctionHouseName,
    pickupAddress: d.pickupAddress,
    pickupPostalCode: d.pickupPostalCode,
    pickupCity: d.pickupCity,
    pickupLat: d.pickupLat,
    pickupLng: d.pickupLng,
    pickupPhone: d.pickupPhone,
    saleDate: toDateInputValue(d.saleDate),
    recipientName: d.recipientName,
    deliveryAddress: d.deliveryAddress,
    deliveryAddressLine2: d.deliveryAddressLine2,
    deliveryPostalCode: d.deliveryPostalCode,
    deliveryCity: d.deliveryCity,
    deliveryLat: d.deliveryLat,
    deliveryLng: d.deliveryLng,
    deliveryCountry: d.deliveryCountry,
    deliveryPhone: d.deliveryPhone,
    description: d.description,
    lengthCm: d.lengthCm,
    widthCm: d.widthCm,
    heightCm: d.heightCm,
    weightKg: d.weightKg,
    isProtected: d.isProtected,
    declaredValueCents: d.declaredValueCents,
    valueBracket: d.valueBracket,
    acceptedPriceCents: d.acceptedPriceCents,
  };
}

/**
 * Whether this quote is sitting past its escalation deadline with nobody
 * assigned — the SQL mirror is `ESCALATION_DUE` in `expedion-report.dal.ts`;
 * kept in step with it by the same five checks.
 */
function isEscalationDue(d: QuoteDetail, now: Date): boolean {
  if (d.status !== "paid") return false;
  if (d.assignedCarrierId) return false;
  if (d.listingId) return false;
  if (d.escalatedAt) return false;
  if (!d.escalateAfter) return false;
  const deadline =
    d.escalateAfter instanceof Date ? d.escalateAfter : new Date(d.escalateAfter);
  return !Number.isNaN(deadline.getTime()) && deadline.getTime() <= now.getTime();
}

export interface QuoteDetailDialogProps {
  quoteId: string | null;
  onClose: () => void;
  /**
   * Opens straight into edit mode. Set when the caller opened this dialog
   * because the row was blocked from escalating — reading the read-only view
   * first would just be a click the operator has to make on every one of
   * these.
   */
  autoEdit?: boolean;
}

export function QuoteDetailDialog({
  quoteId,
  onClose,
  autoEdit = false,
}: QuoteDetailDialogProps) {
  const t = useTranslations("admin.expedion.detail");
  const tb = useTranslations("admin.expedion.blockers");
  const ta = useTranslations("admin.expedion.actions");
  const locale = useLocale();

  const { data, isLoading, error } = useExpedionQuoteDetail(quoteId);

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<QuoteAdminPatch>({});
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const { mutate: saveEdit, isPending: isSaving } = useExpedionQuoteAdmin();
  const { mutate: reextract, isPending: isAnalyzing } = useExpedionReextract();
  const { mutate: escalate, isPending: isEscalating } = useExpedionEscalate();

  // One `now` for the life of this dialog, so the deadline check and the
  // banner it drives cannot disagree mid-edit.
  const now = useMemo(() => new Date(), [quoteId]);

  // A different quote opened mid-edit should not carry the previous one's
  // draft into it.
  useEffect(() => {
    setIsEditing(false);
    setConfirmingPublish(false);
  }, [quoteId]);

  function enterEdit(source: QuoteDetail) {
    setForm(buildEditForm(source));
    setIsEditing(true);
  }

  useEffect(() => {
    if (autoEdit && data) enterEdit(data);
    // Only when the quote first loads for this open — re-running on every
    // `data` change (e.g. after a save) would blow away what the operator is
    // mid-typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEdit, data]);

  function setField<K extends keyof QuoteAdminPatch>(
    key: K,
    value: QuoteAdminPatch[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setPickupLocation(value: LocationPickerValue) {
    setForm((f) => ({
      ...f,
      pickupAddress: value.address || null,
      pickupCity: value.city || null,
      pickupPostalCode: value.postalCode || null,
      pickupLat: value.lat,
      pickupLng: value.lng,
    }));
  }

  function setDeliveryLocation(value: LocationPickerValue) {
    setForm((f) => ({
      ...f,
      deliveryAddress: value.address || null,
      deliveryCity: value.city || null,
      deliveryPostalCode: value.postalCode || null,
      deliveryLat: value.lat,
      deliveryLng: value.lng,
    }));
  }

  function saveChanges() {
    if (!quoteId) return;
    saveEdit(
      { id: quoteId, patch: form },
      { onSuccess: () => setIsEditing(false) }
    );
  }

  /** Saves the draft and publishes in the same action, once nothing blocks it. */
  function saveAndPublish() {
    if (!quoteId) return;
    saveEdit(
      { id: quoteId, patch: form },
      {
        onSuccess: () => {
          setIsEditing(false);
          escalate(quoteId, { onSuccess: onClose });
        },
      }
    );
  }

  function analyzeWithAi() {
    if (!quoteId) return;
    reextract(quoteId, {
      onSuccess: (result) => {
        toast.success(t("reextractSuccess"));
        // Drop straight into edit mode with the freshly extracted values, so
        // the operator reviews and corrects rather than hunting for what
        // changed.
        enterEdit(result.quote as QuoteDetail);
      },
      onError: () => toast.error(t("reextractFailed")),
    });
  }

  const dateTime = (value: string | Date | null | undefined): string => {
    if (!value) return "—";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const money = (cents: number | null | undefined): string =>
    cents === null || cents === undefined ? "—" : formatCurrency(cents);

  const documents = data
    ? [
        ...(data.bordereauDocUrl
          ? [{ url: data.bordereauDocUrl, label: t("bordereau") }]
          : []),
        ...((data.photoUrls ?? []) as string[]).map((url, index) => ({
          url,
          label: t("photo", { index: index + 1 }),
        })),
      ]
    : [];

  const escalationDue = data ? isEscalationDue(data, now) : false;
  // Checked against the live draft while editing, and against the stored row
  // otherwise — both shapes carry the same ten fields, so the same check
  // answers "what's still missing" either way.
  const blockers = data
    ? draftEscalationBlockers(isEditing ? form : data)
    : [];
  const readyToPublish = escalationDue && blockers.length === 0;
  const busy = isSaving || isEscalating;

  return (
    <>
      <Dialog open={quoteId !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b p-6 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {t("title", {
                    reference: data?.quoteNumber ?? data?.bordereauNumber ?? "—",
                  })}
                  {data ? (
                    <>
                      <Badge variant="secondary">{data.status}</Badge>
                      <Badge variant="outline">{data.paymentStatus}</Badge>
                    </>
                  ) : null}
                </DialogTitle>
                <DialogDescription asChild>
                  {/* The id, not the quote number, is what the two products share:
                      Expedion shows the same string on the client's own quote, so an
                      operator and a client can name the same row out loud. */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs break-all">
                      {quoteId ?? ""}
                    </span>
                    {quoteId ? <CopyButton value={quoteId} /> : null}
                  </div>
                </DialogDescription>
              </div>

              {data ? (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(false)}
                        disabled={busy}
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        {t("cancel")}
                      </Button>
                      <Button
                        size="sm"
                        variant={readyToPublish ? "outline" : "default"}
                        onClick={saveChanges}
                        disabled={busy}
                      >
                        {isSaving && !isEscalating ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        {isSaving ? t("saving") : t("save")}
                      </Button>
                      {readyToPublish ? (
                        <Button size="sm" onClick={saveAndPublish} disabled={busy}>
                          {busy ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="mr-1 h-3.5 w-3.5" />
                          )}
                          {t("saveAndPublish")}
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {readyToPublish ? (
                        <Button size="sm" onClick={() => setConfirmingPublish(true)}>
                          <Send className="mr-1 h-3.5 w-3.5" />
                          {ta("publish")}
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => enterEdit(data)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        {t("edit")}
                      </Button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </DialogHeader>

          {data && escalationDue ? (
            <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted-foreground text-xs font-medium">
                  {blockers.length === 0 ? t("readyToPublish") : t("blockedBanner")}
                </span>
                {blockers.map((code) => (
                  <Badge key={code} variant="destructive" className="text-[10px]">
                    {tb(code)}
                  </Badge>
                ))}
              </div>
              {!isEditing && blockers.length > 0 ? (
                <Button size="sm" variant="outline" onClick={() => enterEdit(data)}>
                  {t("fixNow")}
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-16">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("loading")}
              </div>
            ) : error || !data ? (
              <p className="text-destructive py-16 text-center text-sm">
                {error instanceof Error ? error.message : t("error")}
              </p>
            ) : (
              <div className="space-y-6">
                <Section title={t("documents")}>
                  <div className="mb-3">
                    {data.bordereauDocUrl ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={analyzeWithAi}
                        disabled={isAnalyzing}
                      >
                        {isAnalyzing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        {isAnalyzing ? t("analyzing") : t("analyzeWithAi")}
                      </Button>
                    ) : (
                      <p className="text-muted-foreground text-xs">
                        {t("noDocumentToAnalyze")}
                      </p>
                    )}
                  </div>
                  {documents.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      {t("noDocuments")}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {documents.map((doc) => (
                        <DocumentPreview
                          key={doc.url}
                          url={doc.url}
                          label={doc.label}
                          openLabel={t("openDocument")}
                          unavailableLabel={t("documentNotPreviewable")}
                        />
                      ))}
                    </div>
                  )}
                </Section>

                <Section title={t("client")}>
                  {isEditing ? (
                    <>
                      <EditableField
                        label={t("firstName")}
                        value={form.firstName ?? ""}
                        onChange={(v) => setField("firstName", v || null)}
                      />
                      <EditableField
                        label={t("lastName")}
                        value={form.lastName ?? ""}
                        onChange={(v) => setField("lastName", v || null)}
                      />
                      <EditableField
                        label={t("email")}
                        type="email"
                        value={form.email ?? ""}
                        onChange={(v) => setField("email", v || null)}
                      />
                      <EditableField
                        label={t("phone")}
                        value={form.phone ?? ""}
                        onChange={(v) => setField("phone", v || null)}
                      />
                      <EditableField
                        label={t("address")}
                        value={form.clientAddress ?? ""}
                        onChange={(v) => setField("clientAddress", v || null)}
                      />
                      <EditableField
                        label={t("postalCode")}
                        value={form.clientPostalCode ?? ""}
                        onChange={(v) => setField("clientPostalCode", v || null)}
                      />
                      <EditableField
                        label={t("city")}
                        value={form.clientCity ?? ""}
                        onChange={(v) => setField("clientCity", v || null)}
                      />
                      <EditableField
                        label={t("country")}
                        value={form.clientCountry ?? ""}
                        onChange={(v) => setField("clientCountry", v || null)}
                      />
                    </>
                  ) : (
                    <>
                      <Field
                        label={t("name")}
                        value={
                          [data.firstName, data.lastName]
                            .filter(Boolean)
                            .join(" ") || "—"
                        }
                      />
                      <Field label={t("email")} value={data.email} copyable />
                      <Field label={t("phone")} value={data.phone} />
                      <Field
                        label={t("address")}
                        value={[
                          data.clientAddress,
                          [data.clientPostalCode, data.clientCity]
                            .filter(Boolean)
                            .join(" "),
                          data.clientCountry,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      />
                    </>
                  )}
                </Section>

                <Section title={t("pickup")}>
                  {isEditing ? (
                    <>
                      <EditableField
                        label={t("auctionHouse")}
                        value={form.auctionHouseName ?? ""}
                        onChange={(v) => setField("auctionHouseName", v || null)}
                      />
                      <EditableField
                        label={t("phone")}
                        value={form.pickupPhone ?? ""}
                        onChange={(v) => setField("pickupPhone", v || null)}
                      />
                      <EditableField
                        label={t("saleDate")}
                        type="date"
                        value={form.saleDate ?? ""}
                        onChange={(v) => setField("saleDate", v || null)}
                      />
                      <div className="sm:col-span-2">
                        <LocationPickerField
                          id="quote-edit-pickup"
                          value={{
                            address: form.pickupAddress ?? "",
                            city: form.pickupCity ?? "",
                            postalCode: form.pickupPostalCode ?? "",
                            lat: form.pickupLat ?? null,
                            lng: form.pickupLng ?? null,
                          }}
                          onChange={setPickupLocation}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <Field
                        label={t("auctionHouse")}
                        value={data.auctionHouseName}
                      />
                      <Field
                        label={t("address")}
                        value={[
                          data.pickupAddress,
                          [data.pickupPostalCode, data.pickupCity]
                            .filter(Boolean)
                            .join(" "),
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      />
                      <Field label={t("phone")} value={data.pickupPhone} />
                      <Field
                        label={t("saleDate")}
                        value={dateTime(data.saleDate)}
                      />
                      <Field
                        label={t("coordinates")}
                        value={
                          data.pickupLat !== null && data.pickupLng !== null
                            ? `${data.pickupLat}, ${data.pickupLng}`
                            : null
                        }
                      />
                    </>
                  )}
                </Section>

                <Section title={t("delivery")}>
                  {isEditing ? (
                    <>
                      <EditableField
                        label={t("recipient")}
                        value={form.recipientName ?? ""}
                        onChange={(v) => setField("recipientName", v || null)}
                      />
                      <EditableField
                        label={t("phone")}
                        value={form.deliveryPhone ?? ""}
                        onChange={(v) => setField("deliveryPhone", v || null)}
                      />
                      <EditableField
                        label={t("addressLine2")}
                        value={form.deliveryAddressLine2 ?? ""}
                        onChange={(v) =>
                          setField("deliveryAddressLine2", v || null)
                        }
                      />
                      <EditableField
                        label={t("country")}
                        value={form.deliveryCountry ?? ""}
                        onChange={(v) => setField("deliveryCountry", v || null)}
                      />
                      <div className="sm:col-span-2">
                        <LocationPickerField
                          id="quote-edit-delivery"
                          value={{
                            address: form.deliveryAddress ?? "",
                            city: form.deliveryCity ?? "",
                            postalCode: form.deliveryPostalCode ?? "",
                            lat: form.deliveryLat ?? null,
                            lng: form.deliveryLng ?? null,
                          }}
                          onChange={setDeliveryLocation}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <Field label={t("recipient")} value={data.recipientName} />
                      <Field
                        label={t("address")}
                        value={[
                          data.deliveryAddress,
                          data.deliveryAddressLine2,
                          [data.deliveryPostalCode, data.deliveryCity]
                            .filter(Boolean)
                            .join(" "),
                          data.deliveryCountry,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      />
                      <Field label={t("phone")} value={data.deliveryPhone} />
                      <Field
                        label={t("coordinates")}
                        value={
                          data.deliveryLat !== null && data.deliveryLng !== null
                            ? `${data.deliveryLat}, ${data.deliveryLng}`
                            : null
                        }
                      />
                    </>
                  )}
                </Section>

                <Section title={t("lot")}>
                  {isEditing ? (
                    <>
                      <div className="min-w-0 text-sm sm:col-span-2">
                        <Label className="text-muted-foreground text-xs font-normal">
                          {t("description")}
                        </Label>
                        <Textarea
                          value={form.description ?? ""}
                          onChange={(e) =>
                            setField("description", e.target.value || null)
                          }
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                      <div className="min-w-0 text-sm">
                        <Label className="text-muted-foreground text-xs font-normal">
                          {t("dimensions")}
                        </Label>
                        <div className="mt-1 flex items-center gap-1">
                          <Input
                            type="number"
                            value={form.lengthCm?.toString() ?? ""}
                            onChange={(e) =>
                              setField(
                                "lengthCm",
                                e.target.value === "" ? null : Number(e.target.value)
                              )
                            }
                            placeholder="L"
                            className="h-8"
                          />
                          <span className="text-muted-foreground">×</span>
                          <Input
                            type="number"
                            value={form.widthCm?.toString() ?? ""}
                            onChange={(e) =>
                              setField(
                                "widthCm",
                                e.target.value === "" ? null : Number(e.target.value)
                              )
                            }
                            placeholder="l"
                            className="h-8"
                          />
                          <span className="text-muted-foreground">×</span>
                          <Input
                            type="number"
                            value={form.heightCm?.toString() ?? ""}
                            onChange={(e) =>
                              setField(
                                "heightCm",
                                e.target.value === "" ? null : Number(e.target.value)
                              )
                            }
                            placeholder="h"
                            className="h-8"
                          />
                          <span className="text-muted-foreground text-xs">cm</span>
                        </div>
                      </div>
                      <EditableField
                        label={t("weight")}
                        type="number"
                        value={form.weightKg?.toString() ?? ""}
                        onChange={(v) =>
                          setField("weightKg", v === "" ? null : Number(v))
                        }
                        placeholder="kg"
                      />
                      <div className="flex items-center gap-2 text-sm">
                        <Checkbox
                          id="quote-edit-protected"
                          checked={form.isProtected ?? false}
                          onCheckedChange={(checked) =>
                            setField("isProtected", checked === true)
                          }
                        />
                        <Label
                          htmlFor="quote-edit-protected"
                          className="text-sm font-normal"
                        >
                          {t("protected")}
                        </Label>
                      </div>
                      <EditableField
                        label={t("declaredValue")}
                        type="number"
                        value={
                          form.declaredValueCents != null
                            ? String(form.declaredValueCents / 100)
                            : ""
                        }
                        onChange={(v) =>
                          setField(
                            "declaredValueCents",
                            v === "" ? null : Math.round(Number(v) * 100)
                          )
                        }
                      />
                      <EditableField
                        label={t("valueBracket")}
                        value={form.valueBracket ?? ""}
                        onChange={(v) => setField("valueBracket", v || null)}
                        placeholder="Jusqu'à 150 €"
                      />
                    </>
                  ) : (
                    <>
                      <Field label={t("description")} value={data.description} />
                      <Field
                        label={t("dimensions")}
                        value={
                          data.lengthCm || data.widthCm || data.heightCm
                            ? `${data.lengthCm ?? "?"} × ${
                                data.widthCm ?? "?"
                              } × ${data.heightCm ?? "?"} cm`
                            : null
                        }
                      />
                      <Field
                        label={t("weight")}
                        value={data.weightKg ? `${data.weightKg} kg` : null}
                      />
                      <Field
                        label={t("protected")}
                        value={data.isProtected ? t("yes") : t("no")}
                      />
                      <Field
                        label={t("declaredValue")}
                        value={
                          data.declaredValueCents !== null
                            ? money(data.declaredValueCents)
                            : (data.valueBracket ?? null)
                        }
                      />
                    </>
                  )}
                </Section>

                <Section title={t("pricing")}>
                  <Field
                    label={t("standard")}
                    value={money(data.quoteStandardCents)}
                  />
                  <Field
                    label={t("insured")}
                    value={money(data.quoteInsuredCents)}
                  />
                  {isEditing ? (
                    <EditableField
                      label={t("accepted")}
                      type="number"
                      value={
                        form.acceptedPriceCents != null
                          ? String(form.acceptedPriceCents / 100)
                          : ""
                      }
                      onChange={(v) =>
                        setField(
                          "acceptedPriceCents",
                          v === "" ? null : Math.round(Number(v) * 100)
                        )
                      }
                      placeholder="0"
                    />
                  ) : (
                    <Field
                      label={t("accepted")}
                      value={
                        data.acceptedPriceCents !== null
                          ? `${money(data.acceptedPriceCents)}${
                              data.acceptedKind ? ` (${data.acceptedKind})` : ""
                            }`
                          : null
                      }
                    />
                  )}
                  <Field
                    label={t("published")}
                    value={data.quoteAvailable ? t("yes") : t("no")}
                  />
                </Section>

                <Section title={t("flow")}>
                  <Field
                    label={t("requestedAt")}
                    value={dateTime(data.requestedAt)}
                  />
                  <Field
                    label={t("assignedCarrier")}
                    value={data.assignedCarrierId}
                  />
                  <Field label={t("listing")} value={data.listingId} />
                  <Field
                    label={t("escalateAfter")}
                    value={dateTime(data.escalateAfter)}
                  />
                  <Field
                    label={t("escalatedAt")}
                    value={dateTime(data.escalatedAt)}
                  />
                  <Field
                    label={t("storageFreeUntil")}
                    value={dateTime(data.storageFreeUntil)}
                  />
                  <Field
                    label={t("storageFee")}
                    value={
                      data.storageDailyFeeCents !== null
                        ? t("perDay", { value: money(data.storageDailyFeeCents) })
                        : null
                    }
                  />
                  <Field
                    label={t("extraction")}
                    value={
                      data.extractionConfidence !== null
                        ? t("confidence", {
                            percent: Math.round(data.extractionConfidence * 100),
                            model: data.extractionModel ?? "—",
                          })
                        : null
                    }
                  />
                  <Field label={t("comment")} value={data.comment} />
                </Section>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Publish confirmation for the "already ready, not editing" path — an
          `AlertDialog` rather than the plain `Dialog` the rest of this uses,
          because publishing is not reversible. Mirrors `EscalateDialog`,
          which this dialog cannot reuse directly: that one takes a `QuoteRow`
          from the report's lean projection, and this one only ever has the
          full `QuoteDetail`. */}
      <AlertDialog open={confirmingPublish} onOpenChange={setConfirmingPublish}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ta("escalateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {ta("escalateBody", {
                reference: data?.quoteNumber ?? data?.bordereauNumber ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isEscalating}>
              {ta("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (!quoteId) return;
                escalate(quoteId, {
                  onSuccess: () => setConfirmingPublish(false),
                });
              }}
              disabled={isEscalating}
            >
              {isEscalating ? ta("publishing") : ta("publish")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      <Separator className="mb-3" />
      <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: string | number | null | undefined;
  copyable?: boolean;
}) {
  const shown =
    value === null || value === undefined || value === "" ? "—" : String(value);

  return (
    <div className="min-w-0 text-sm">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="flex items-center gap-1 break-words">
        <span className="min-w-0 break-words">{shown}</span>
        {copyable && shown !== "—" ? <CopyButton value={shown} /> : null}
      </div>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "date" | "number";
  placeholder?: string;
}) {
  return (
    <div className="min-w-0 text-sm">
      <Label className="text-muted-foreground text-xs font-normal">
        {label}
      </Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-8"
      />
    </div>
  );
}

/**
 * The uploaded slip, shown rather than linked.
 *
 * A link alone means leaving the queue to answer a question the queue asked, so
 * images render inline and PDFs in a frame. A value that is not an absolute URL
 * is shown as text: the column is a free string and older rows hold a storage
 * key, which no `<img>` can resolve — printing it beats an empty box.
 */
function DocumentPreview({
  url,
  label,
  openLabel,
  unavailableLabel,
}: {
  url: string;
  label: string;
  openLabel: string;
  unavailableLabel: string;
}) {
  const previewable = isPreviewable(url);
  const image = previewable && looksLikeImage(url);

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          {image ? (
            <ImageIcon className="h-4 w-4 shrink-0" />
          ) : (
            <FileText className="h-4 w-4 shrink-0" />
          )}
          <span className="truncate">{label}</span>
        </div>
        {previewable ? (
          <Button asChild variant="ghost" size="sm" className="h-7">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              {openLabel}
            </a>
          </Button>
        ) : null}
      </div>
      {previewable ? (
        image ? (
          <img
            src={url}
            alt={label}
            className="max-h-[420px] w-full bg-muted object-contain"
          />
        ) : (
          <iframe
            src={url}
            title={label}
            className="h-[420px] w-full bg-muted"
          />
        )
      ) : (
        <div className="p-3">
          <p className="text-muted-foreground mb-1 text-xs">
            {unavailableLabel}
          </p>
          <p className="font-mono text-xs break-all">{url}</p>
        </div>
      )}
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      onClick={(event) => {
        event.stopPropagation();
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? (
        <Check className="h-3 w-3" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
}
