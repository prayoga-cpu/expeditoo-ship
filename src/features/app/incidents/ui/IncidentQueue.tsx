"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useIncidentQueue, useUpdateIncident } from "../hooks/useIncidents";
import type { IncidentStatus, QueuedIncident } from "../api";

const TABS: IncidentStatus[] = ["OPEN", "ACKNOWLEDGED", "RESOLVED"];

/**
 * The operator queue — the adjudication step the whole feature routes into.
 *
 * Ordered severity before age server-side, so the worst thing on the platform
 * is the first row an operator sees rather than the oldest.
 */
export function IncidentQueue() {
  const t = useTranslations("incidents");
  const [status, setStatus] = useState<IncidentStatus>("OPEN");
  const { page, isLoading, isError } = useIncidentQueue({ status, limit: 50 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("queue.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("queue.subtitle")}</p>
      </div>

      <Tabs
        value={status}
        onValueChange={(value) => setStatus(value as IncidentStatus)}
      >
        <TabsList>
          {TABS.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`statuses.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading && <LottieLoader />}

      {isError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {t("queue.error")}
        </p>
      )}

      {!isLoading && !isError && !page?.items.length && (
        <CenteredEmptyState
          icon={AlertTriangle}
          title={t("queue.emptyTitle")}
          description={t("queue.emptyDescription")}
        />
      )}

      <div className="space-y-3">
        {page?.items.map((incident) => (
          <QueueRow key={incident.id} incident={incident} />
        ))}
      </div>
    </div>
  );
}

function QueueRow({ incident }: { incident: QueuedIncident }) {
  const t = useTranslations("incidents");
  const update = useUpdateIncident();

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">
          {t(`categories.${incident.category}`)}
        </span>
        <Badge variant="outline">{t(`severities.${incident.severity}`)}</Badge>
        <Badge variant="outline">{t(`statuses.${incident.status}`)}</Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(incident.createdAt), {
            addSuffix: true,
          })}
        </span>
      </div>

      <p className="text-sm whitespace-pre-wrap">{incident.description}</p>

      {incident.photoUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {incident.photoUrls.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer">
              <img
                src={url}
                alt=""
                className="h-16 w-16 rounded-lg border border-border object-cover"
              />
            </a>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          {t("list.reportedBy", {
            name: incident.reporter.name ?? t("list.unknownReporter"),
            role: t(`roles.${incident.reporter.role}`),
          })}
        </span>
        <Link
          href={`/admin/shipments?search=${incident.shipmentId}`}
          className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
        >
          {incident.shipmentTitle ?? incident.shipmentId}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {incident.status !== "RESOLVED" && (
        <div className="flex flex-wrap gap-2">
          {incident.status === "OPEN" && (
            <Button
              size="sm"
              variant="outline"
              disabled={update.isPending}
              onClick={() =>
                update.mutate({
                  incidentId: incident.id,
                  status: "ACKNOWLEDGED",
                })
              }
            >
              {t("queue.acknowledge")}
            </Button>
          )}
          <ResolveDialog incidentId={incident.id} />
        </div>
      )}

      {incident.resolutionNote && (
        <p className="rounded-md border border-border bg-muted/40 p-2 text-xs">
          {t("list.resolution")}: {incident.resolutionNote}
        </p>
      )}
    </Card>
  );
}

/** Resolving demands a note — a queue emptied without reasons teaches nothing. */
function ResolveDialog({ incidentId }: { incidentId: string }) {
  const t = useTranslations("incidents");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const update = useUpdateIncident();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{t("queue.resolve")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("queue.resolveTitle")}</DialogTitle>
        </DialogHeader>
        <Textarea
          rows={4}
          placeholder={t("queue.resolvePlaceholder")}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("report.cancel")}
          </Button>
          <Button
            disabled={note.trim().length < 3 || update.isPending}
            onClick={() =>
              update.mutate(
                {
                  incidentId,
                  status: "RESOLVED",
                  resolutionNote: note.trim(),
                },
                { onSuccess: () => setOpen(false) }
              )
            }
          >
            {t("queue.resolve")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
