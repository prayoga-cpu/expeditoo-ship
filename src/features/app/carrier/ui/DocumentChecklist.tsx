"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Eye, FileText, Upload } from "lucide-react";
import {
  DOCUMENT_KINDS,
  REQUIRED_DOCUMENT_KINDS,
  EXPIRING_DOCUMENT_KINDS,
} from "@/server/dto/carrier.dto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useUploadDocument, useViewDocument } from "../hooks/useCarrier";
import type { CarrierDocument } from "../api/carrier.api";

const STATUS_TONE: Record<CarrierDocument["status"], string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  accepted: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
};

interface DocumentChecklistProps {
  documents: CarrierDocument[];
  canUpload: boolean;
}

/** One row per document kind; upload replaces, viewing goes via a signed URL. */
export function DocumentChecklist({ documents, canUpload }: DocumentChecklistProps) {
  const t = useTranslations("carrier.application.documents");
  const byKind = new Map(documents.map((doc) => [doc.kind, doc]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {DOCUMENT_KINDS.map((kind) => (
          <DocumentRow
            key={kind}
            kind={kind}
            document={byKind.get(kind)}
            required={(REQUIRED_DOCUMENT_KINDS as readonly string[]).includes(kind)}
            canUpload={canUpload}
          />
        ))}
      </CardContent>
    </Card>
  );
}

interface DocumentRowProps {
  kind: string;
  document: CarrierDocument | undefined;
  required: boolean;
  canUpload: boolean;
}

function DocumentRow({ kind, document, required, canUpload }: DocumentRowProps) {
  const t = useTranslations("carrier.application.documents");
  const upload = useUploadDocument();
  const view = useViewDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const canExpire = (EXPIRING_DOCUMENT_KINDS as readonly string[]).includes(kind);

  function onFileChosen(file: File | undefined) {
    if (!file) return;
    upload.mutate({ kind, file, expiresAt: expiresAt || undefined });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {t(`kinds.${kind}`)}{" "}
          {!required && (
            <span className="text-xs text-muted-foreground">{t("optionalTag")}</span>
          )}
        </p>
        <DocumentRowStatus document={document} />
      </div>

      <div className="flex items-center gap-2">
        {document && (
          <Button
            variant="ghost"
            size="sm"
            disabled={view.isPending}
            onClick={() => view.mutate(document.id)}
          >
            <Eye className="mr-1.5 h-4 w-4" />
            {t("view")}
          </Button>
        )}
        {canUpload && (
          <>
            {canExpire && (
              <Input
                type="date"
                className="h-9 w-auto"
                aria-label={t("expiryLabel")}
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
              />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(event) => onFileChosen(event.target.files?.[0])}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={upload.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {upload.isPending
                ? t("uploading")
                : document
                  ? t("replace")
                  : t("upload")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function DocumentRowStatus({ document }: { document: CarrierDocument | undefined }) {
  const t = useTranslations("carrier.application.documents");

  if (!document) {
    return <p className="text-xs text-muted-foreground">{t("missing")}</p>;
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <Badge className={STATUS_TONE[document.status]}>
        {t(`status.${document.status}`)}
      </Badge>
      {document.expiresAt && (
        <span className="text-xs text-muted-foreground">
          {t("expires", { date: format(new Date(document.expiresAt), "d MMM yyyy") })}
        </span>
      )}
      {document.status === "rejected" && document.rejectionReason && (
        <span className="text-xs text-destructive">{document.rejectionReason}</span>
      )}
    </div>
  );
}
