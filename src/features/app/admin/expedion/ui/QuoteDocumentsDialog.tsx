"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { expedionFileIdFromUrl } from "@/lib/expedion-files";
import { useExpedionQuoteDocuments } from "../hooks/useExpedionReport";
import { DocumentPreview } from "./QuoteDetailDialog";

interface QuoteDocumentsDialogProps {
  quoteId: string | null;
  /** What the table row knows: a client's own upload, or an older stored link. */
  legacyUrl?: string | null;
  title: string;
  onClose: () => void;
}

/**
 * Every document of one quote, previewed in a pop-up — the slip, its invoices,
 * powers of attorney and photos — so a row of the Slips table never ends in a
 * link that does nothing. Files imported from Airtable and files a client
 * uploaded come from the same list; a quote whose only document is an older
 * stored link (one with no filed row) still shows it.
 */
export function QuoteDocumentsDialog({
  quoteId,
  legacyUrl,
  title,
  onClose,
}: QuoteDocumentsDialogProps) {
  const t = useTranslations("admin.expedion.detail");
  const tb = useTranslations("admin.bordereaux");
  const { data, isLoading, isError, refetch } = useExpedionQuoteDocuments(quoteId);

  const filed = data ?? [];
  const legacyId = expedionFileIdFromUrl(legacyUrl);
  const showLegacy = Boolean(legacyUrl) && !(legacyId && filed.some((f) => f.id === legacyId));

  return (
    <Dialog open={quoteId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{tb("documentsDialogHint")}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : isError ? (
          <div className="space-y-3 p-4 text-sm">
            <p>{tb("documentsFailed")}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {tb("retry")}
            </Button>
          </div>
        ) : filed.length === 0 && !showLegacy ? (
          <p className="text-muted-foreground p-4 text-sm">{t("noDocuments")}</p>
        ) : (
          <div className="space-y-4">
            {showLegacy && legacyUrl ? (
              <DocumentPreview
                url={legacyUrl}
                label={t("bordereau")}
                openLabel={t("openDocument")}
                unavailableLabel={t("documentNotPreviewable")}
              />
            ) : null}
            {filed.map((file) => (
              <DocumentPreview
                key={file.id}
                url={file.url}
                label={t(`docKind.${file.kind}` as never)}
                openLabel={t("openDocument")}
                unavailableLabel={t("documentNotPreviewable")}
                mimeType={file.mimeType}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
