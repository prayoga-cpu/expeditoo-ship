"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { ExpedionQuote } from "@/db/schema/expedion";

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
 * It reads `GET /api/expedion/quotes/:id`, the same endpoint the client app
 * uses for its own quote; that route hands an admin any row and a non-owner a
 * 404, so nothing here widens who can see what.
 */

/** A value that left the server as a `Date` and arrived as an ISO string. */
type Wire<T> = {
  [K in keyof T]: T[K] extends Date | null
    ? string | Date | null
    : T[K] extends Date
      ? string | Date
      : T[K];
};

type QuoteDetail = Wire<ExpedionQuote>;

interface Envelope {
  success: boolean;
  data?: QuoteDetail;
  error?: { code: string; message: string };
}

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

export interface QuoteDetailDialogProps {
  quoteId: string | null;
  onClose: () => void;
}

export function QuoteDetailDialog({
  quoteId,
  onClose,
}: QuoteDetailDialogProps) {
  const t = useTranslations("admin.expedion.detail");
  const locale = useLocale();

  const { data, isLoading, error } = useQuery<QuoteDetail>({
    queryKey: ["admin", "expedion", "quote", quoteId],
    enabled: quoteId !== null,
    queryFn: async () => {
      const response = await fetch(`/api/expedion/quotes/${quoteId}`);

      /*
       * Read the body as text and parse it here, rather than `response.json()`.
       * A route that throws before it can answer — a refused database
       * connection, a crashed render — replies with Next's HTML error page, and
       * `response.json()` then fails with `Unexpected token '<'`, which is what
       * the operator ends up reading inside the dialog. The status is the fact
       * worth showing; the parser's complaint about the first character is not.
       */
      const raw = await response.text();
      let body: Envelope | null = null;
      try {
        body = JSON.parse(raw) as Envelope;
      } catch {
        body = null;
      }

      if (!body) {
        throw new Error(
          response.ok
            ? "The server sent something that is not a quote."
            : `The server refused this quote (HTTP ${response.status}).`
        );
      }

      if (!response.ok || !body.success || !body.data) {
        throw new Error(body.error?.message ?? "Quote unavailable");
      }
      return body.data;
    },
  });

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
    cents === null || cents === undefined
      ? "—"
      : new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: "EUR",
        }).format(cents / 100);

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

  return (
    <Dialog open={quoteId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b p-6 pb-4">
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
        </DialogHeader>

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
                <Field
                  label={t("name")}
                  value={
                    [data.firstName, data.lastName].filter(Boolean).join(" ") ||
                    "—"
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
              </Section>

              <Section title={t("pickup")}>
                <Field label={t("auctionHouse")} value={data.auctionHouseName} />
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
                <Field label={t("saleDate")} value={dateTime(data.saleDate)} />
                <Field
                  label={t("coordinates")}
                  value={
                    data.pickupLat !== null && data.pickupLng !== null
                      ? `${data.pickupLat}, ${data.pickupLng}`
                      : null
                  }
                />
              </Section>

              <Section title={t("delivery")}>
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
              </Section>

              <Section title={t("lot")}>
                <Field label={t("description")} value={data.description} />
                <Field
                  label={t("dimensions")}
                  value={
                    data.lengthCm || data.widthCm || data.heightCm
                      ? `${data.lengthCm ?? "?"} × ${data.widthCm ?? "?"} × ${
                          data.heightCm ?? "?"
                        } cm`
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
