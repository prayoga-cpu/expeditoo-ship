"use client";

import { Fragment, useState, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import {
  Check,
  ChevronDown,
  ExternalLink,
  LogOut,
  Plane,
  RotateCcw,
  ShieldOff,
  UserCheck,
  Wrench,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { actionsFor, type DriverAction } from "../lib/carrier-actions";
import { isAbsent } from "@/lib/carrier-availability";
import { parseLocalISO, todayLocalISO, addDaysLocalISO } from "@/lib/utils/date-range";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { CarrierStatusBadge } from "./CarrierStatusBadge";
import { ContactConfirmedField } from "./ContactConfirmedField";
import { useCarrierDocumentViewer } from "../hooks/useCarrierApplications";
import type {
  CarrierApplication,
  CarrierApplicationDocument,
  CarrierApplicationVehicle,
  CarrierAvailabilityRequest,
  CarrierFileInput,
} from "../api/carriers.api";
import type { VehicleType } from "@/lib/carrier-constants";
import { CarrierFileEditor } from "./CarrierFileEditor";

interface CarrierApplicationDetailProps {
  application: CarrierApplication;
  isUpdating: boolean;
  onApprove: (id: string) => Promise<unknown>;
  onReject: (input: { id: string; reason: string }) => Promise<unknown>;
  onSuspend: (input: { id: string; reason: string }) => Promise<unknown>;
  /** Actif / Absent / Désinscrit — client_feedback_2026_10_29_spec.md §REQ-02. */
  onSetAvailability: (input: {
    id: string;
    input: CarrierAvailabilityRequest;
  }) => Promise<unknown>;
  onDeregister: (input: { id: string; reason: string }) => Promise<unknown>;
  onReinstate: (id: string) => Promise<unknown>;
  /** « Contact confirmé » — informational (client feedback 2026-11-06, C02). */
  onSetContactConfirmed?: (input: { id: string; confirmed: boolean }) => Promise<unknown>;
  /** Staff finish the file on the applicant's behalf (driver_types_spec.md §7). */
  onSaveFile?: (input: { id: string; data: CarrierFileInput }) => Promise<unknown>;
  onAddVehicle?: (input: {
    id: string;
    vehicle: { type: VehicleType; maxWeightKg: number; plateNumber: string };
  }) => Promise<unknown>;
  /** Called after an action succeeded; the list closes the dialog. */
  onDone: () => void;
  onClose: () => void;
}

type ReasonAction = "reject" | "suspend" | "deregister" | "absent";

const ACTION_ICONS: Record<DriverAction, ReactNode> = {
  approve: <Check className="w-4 h-4 mr-2" />,
  reject: <X className="w-4 h-4 mr-2" />,
  markAbsent: <Plane className="w-4 h-4 mr-2" />,
  endAbsence: <UserCheck className="w-4 h-4 mr-2" />,
  suspend: <ShieldOff className="w-4 h-4 mr-2" />,
  reactivate: <RotateCcw className="w-4 h-4 mr-2" />,
  remove: <LogOut className="w-4 h-4 mr-2" />,
};

function Field({
  label,
  value,
  mono = false,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <h4 className="text-sm font-medium text-muted-foreground mb-1">
        {label}
      </h4>
      <p className={mono ? "font-mono" : undefined}>{value}</p>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function DocumentRow({
  document,
  onView,
  isOpening,
}: {
  document: CarrierApplicationDocument;
  onView: () => void;
  isOpening: boolean;
}) {
  const t = useTranslations("admin.carriers");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enUS;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">
          {t(`documentKinds.${document.kind}`)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatSize(document.sizeBytes)}
          {document.expiresAt &&
            ` · ${t("detail.expiresOn", {
              date: format(new Date(document.expiresAt), "dd MMM yyyy", {
                locale: dateLocale,
              }),
            })}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge
          variant={
            document.status === "rejected"
              ? "destructive"
              : document.status === "accepted"
                ? "default"
                : "secondary"
          }
          className={
            document.status === "accepted"
              ? "bg-green-500 hover:bg-green-600 text-white"
              : ""
          }
        >
          {t(`detail.documentStatus.${document.status}`)}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={onView}
          disabled={isOpening}
        >
          {isOpening ? (
            <LottieLoader width={16} height={16} />
          ) : (
            <ExternalLink className="w-4 h-4 mr-1" />
          )}
          {t("detail.view")}
        </Button>
      </div>
    </div>
  );
}

function VehicleRow({ vehicle }: { vehicle: CarrierApplicationVehicle }) {
  const t = useTranslations("admin.carriers");

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {t(`vehicleTypes.${vehicle.type}`)}
          {vehicle.make && ` · ${vehicle.make}${vehicle.model ? ` ${vehicle.model}` : ""}`}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("detail.maxWeight", { weight: vehicle.maxWeightKg })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!vehicle.isActive && (
          <Badge variant="secondary">{t("detail.inactive")}</Badge>
        )}
        <span className="font-mono bg-muted px-2 py-1 rounded text-sm">
          {vehicle.plateNumber}
        </span>
      </div>
    </div>
  );
}

export function CarrierApplicationDetail({
  application,
  isUpdating,
  onApprove,
  onReject,
  onSuspend,
  onSetAvailability,
  onDeregister,
  onReinstate,
  onSetContactConfirmed,
  onSaveFile,
  onAddVehicle,
  onDone,
  onClose,
}: CarrierApplicationDetailProps) {
  const [editing, setEditing] = useState(false);
  const [actionMode, setActionMode] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState("");
  // « Retour le » for an absence; "" is "until someone ends it".
  const [returnDay, setReturnDay] = useState("");
  const t = useTranslations("admin.carriers.detail");
  const locale = useLocale();
  const { openDocument, openingDocId } = useCarrierDocumentViewer();

  const dateLocale = locale === "fr" ? fr : enUS;
  // rejectCarrierSchema / suspendCarrierSchema / deregisterCarrierSchema
  // require 3-1000 characters; an absence's reason is optional.
  const reasonValid = actionMode === "absent" || reason.trim().length >= 3;
  const canReview =
    application.status === "submitted" ||
    application.status === "under_review";
  // What is offered, by state (driver_page_management_spec.md §2): the footer
  // shows the primary and secondary; the rest sits in « Plus d'actions ».
  const actions = actionsFor(application);
  // An approved file whose owner lacks the role it earns: re-approving is the
  // idempotent backfill (`carrierService.approve`), now offered only here.
  const needsRepair =
    application.status === "approved" && application.hasDriverAccess === false;
  const showActivity =
    application.status === "approved" || application.status === "suspended";
  const absent = isAbsent(application);
  const inHouse = application.kind === "private";
  // What the person has not given yet: the empty file « Gérer le rôle » creates,
  // or an application started and never finished. Staff can fill it in.
  const incomplete = application.contactPhone === "" || application.vehicles.length === 0;
  const notProvided = t("notProvided");

  const runAction = async (action: () => Promise<unknown>) => {
    try {
      await action();
      onDone();
    } catch {
      // Failure toast already raised by the mutation hook.
    }
  };

  // « Approve » is also how a refusal or a removal is undone, so it says so.
  const actionLabel = (action: DriverAction) => {
    switch (action) {
      case "approve":
        return application.status === "rejected"
          ? t("approveAnyway")
          : application.status === "deregistered"
            ? t("reactivateRemoved")
            : t("approve");
      case "reject":
        return t("reject");
      case "markAbsent":
        return t("markAbsent");
      case "endAbsence":
        return t("endAbsence");
      case "suspend":
        return t("suspend");
      case "reactivate":
        return t("reinstate");
      case "remove":
        return t("deregister");
    }
  };

  const perform = (action: DriverAction) => {
    switch (action) {
      case "approve":
        return void runAction(() => onApprove(application.id));
      case "reject":
        return setActionMode("reject");
      case "markAbsent":
        return setActionMode("absent");
      case "endAbsence":
        return void runAction(() =>
          onSetAvailability({ id: application.id, input: { absent: false } }),
        );
      case "suspend":
        return setActionMode("suspend");
      case "reactivate":
        return void runAction(() => onReinstate(application.id));
      case "remove":
        return setActionMode("deregister");
    }
  };

  const handleConfirmReason = () => {
    if (!actionMode || !reasonValid) return;
    const input = { id: application.id, reason: reason.trim() };
    if (actionMode === "absent") {
      void runAction(() =>
        onSetAvailability({
          id: application.id,
          input: {
            absent: true,
            until: returnDay ? parseLocalISO(returnDay).toISOString() : null,
            reason: reason.trim() || null,
          },
        }),
      );
      return;
    }
    void runAction(() =>
      actionMode === "reject"
        ? onReject(input)
        : actionMode === "deregister"
          ? onDeregister(input)
          : onSuspend(input),
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <DialogHeader className="p-6 pb-2">
        <DialogTitle>{t("title")}</DialogTitle>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              {t("applicant")}
            </h4>
            <p className="font-medium">{application.user.name}</p>
            <p className="text-sm text-muted-foreground">
              {application.user.email}
            </p>
          </div>
          <Field
            label={t("submissionDate")}
            value={format(
              new Date(application.createdAt),
              "dd MMMM yyyy HH:mm",
              { locale: dateLocale },
            )}
          />
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              {t("currentStatus")}
            </h4>
            <CarrierStatusBadge status={application.status} absent={absent} />
          </div>
          <Field label={t("kindLabel")} value={t(`kind.${application.kind ?? "professional"}`)} />
        </div>

        {onSaveFile && onAddVehicle && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed p-3">
            <p className="text-sm text-muted-foreground">
              {incomplete ? t("incomplete") : t("editHint")}
            </p>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              {t("completeFile")}
            </Button>
          </div>
        )}

        {absent && (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
            <h4 className="text-sm font-medium mb-1">
              {application.absentUntil
                ? t("absentUntil", {
                    date: format(new Date(application.absentUntil), "dd MMMM yyyy", {
                      locale: dateLocale,
                    }),
                  })
                : t("absentOpenEnded")}
            </h4>
            {application.absenceReason && (
              <p className="text-sm whitespace-pre-wrap">
                {application.absenceReason}
              </p>
            )}
          </div>
        )}
        {needsRepair && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
            <div className="min-w-0 space-y-0.5">
              <h4 className="text-sm font-medium">{t("accessMissingTitle")}</h4>
              <p className="text-muted-foreground text-xs">
                {t("accessMissingBody")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runAction(() => onApprove(application.id))}
              disabled={isUpdating}
            >
              <Wrench className="w-4 h-4 mr-2" />
              {t("repairAccess")}
            </Button>
          </div>
        )}
        {showActivity && (
          <div className="grid grid-cols-2 gap-4 rounded-md border p-3 sm:grid-cols-4">
            <Field
              label={t("liveRuns")}
              value={String(application.liveRuns ?? 0)}
            />
            <Field
              label={t("completedRuns")}
              value={String(application.completedJobs)}
            />
            <Field
              label={t("rating")}
              value={
                application.totalRatings > 0
                  ? t("ratingValue", {
                      rating: application.averageRating.toFixed(1),
                      count: application.totalRatings,
                    })
                  : t("noRatingYet")
              }
            />
            <Field
              label={t("fleet")}
              value={String(application.vehicles.length)}
            />
          </div>
        )}
        {/* A tick that gates nothing only means something while the file waits
            for a decision; afterwards it is just clutter. */}
        {canReview && onSetContactConfirmed && (
          <ContactConfirmedField
            application={application}
            onSet={onSetContactConfirmed}
            disabled={isUpdating}
          />
        )}
        {application.status === "deregistered" && (
          <div className="rounded-md border p-3">
            <h4 className="text-sm font-medium mb-1">
              {application.deregisteredAt
                ? t("deregisteredOn", {
                    date: format(new Date(application.deregisteredAt), "dd MMMM yyyy", {
                      locale: dateLocale,
                    }),
                  })
                : t("deregisteredTitle")}
            </h4>
            {application.deregistrationReason && (
              <p className="text-sm whitespace-pre-wrap">
                {application.deregistrationReason}
              </p>
            )}
          </div>
        )}

        {application.status === "rejected" && application.rejectionReason && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <h4 className="text-sm font-medium mb-1">{t("rejectionReason")}</h4>
            <p className="text-sm whitespace-pre-wrap">
              {application.rejectionReason}
            </p>
          </div>
        )}
        {application.status === "suspended" && application.suspensionReason && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <h4 className="text-sm font-medium mb-1">
              {t("suspensionReason")}
            </h4>
            <p className="text-sm whitespace-pre-wrap">
              {application.suspensionReason}
            </p>
          </div>
        )}

        <div className="border-t pt-4 space-y-4">
          <h3 className="font-semibold">{t("company")}</h3>
          <div className="grid grid-cols-2 gap-4">
            {!inHouse && (
              <>
                <Field label={t("companyName")} value={application.companyName} />
                <Field label={t("siret")} value={application.siret ?? notProvided} mono={application.siret !== null} />
                <Field
                  label={t("vatNumber")}
                  value={application.vatNumber ?? notProvided}
                  mono={application.vatNumber !== null}
                />
                <Field
                  label={t("legalForm")}
                  value={application.legalForm ?? notProvided}
                />
              </>
            )}
            <Field label={t("contactPhone")} value={application.contactPhone || notProvided} />
            <Field
              label={t("address")}
              value={`${application.addressLine}, ${application.postalCode} ${application.city}`}
            />
          </div>
        </div>

        {/* Expeditoo pays an in-house driver as staff: no bank details to show. */}
        {!inHouse && (
          <div className="border-t pt-4 space-y-4">
            <h3 className="font-semibold">{t("banking")}</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field
                label={t("iban")}
                value={
                  application.ibanLast4
                    ? `•••• ${application.ibanLast4}`
                    : notProvided
                }
                mono={application.ibanLast4 !== null}
              />
              <Field
                label={t("bic")}
                value={
                  application.bicLast4
                    ? `•••• ${application.bicLast4}`
                    : notProvided
                }
                mono={application.bicLast4 !== null}
              />
            </div>
          </div>
        )}

        <div className="border-t pt-4 space-y-3">
          <h3 className="font-semibold">{t("fleet")}</h3>
          {application.vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noVehicles")}</p>
          ) : (
            application.vehicles.map((vehicle) => (
              <VehicleRow key={vehicle.id} vehicle={vehicle} />
            ))
          )}
        </div>

        <div className="border-t pt-4 space-y-3">
          <h3 className="font-semibold">{t("documents")}</h3>
          {application.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noDocuments")}</p>
          ) : (
            application.documents.map((document) => (
              <DocumentRow
                key={document.id}
                document={document}
                onView={() => void openDocument(document.id)}
                isOpening={openingDocId === document.id}
              />
            ))
          )}
        </div>
      </div>

      <DialogFooter className="p-6 pt-4 border-t mt-auto">
        <div className="flex w-full flex-col gap-3">
          {actionMode && (
            <div className="space-y-2 text-left">
              {actionMode === "absent" && (
                <div className="space-y-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor="carrier-return-day"
                  >
                    {t("returnDayLabel")}
                  </label>
                  <Input
                    id="carrier-return-day"
                    type="date"
                    min={addDaysLocalISO(todayLocalISO(), 1)}
                    value={returnDay}
                    onChange={(event) => setReturnDay(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("returnDayHint")}
                  </p>
                </div>
              )}
              <label
                className="text-sm font-medium"
                htmlFor="carrier-action-reason"
              >
                {actionMode === "reject"
                  ? t("rejectReasonLabel")
                  : actionMode === "deregister"
                    ? t("deregisterReasonLabel")
                    : actionMode === "absent"
                      ? t("absenceReasonLabel")
                      : t("suspendReasonLabel")}
              </label>
              {/* What this will do, before it is done. */}
              {(actionMode === "suspend" || actionMode === "deregister") && (
                <p className="text-xs text-muted-foreground">
                  {actionMode === "suspend" ? t("suspendHelp") : t("removeHelp")}
                </p>
              )}
              {/* The service refuses this (CARRIER_HAS_LIVE_RUNS); say so
                  before the click rather than after it. */}
              {actionMode === "deregister" && (application.liveRuns ?? 0) > 0 && (
                <p className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs">
                  {t("liveRunsBlock", { count: application.liveRuns ?? 0 })}
                </p>
              )}
              <Textarea
                id="carrier-action-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t("reasonPlaceholder")}
                rows={3}
                maxLength={1000}
              />
            </div>
          )}
          <div className="flex flex-col-reverse flex-wrap gap-2 sm:flex-row sm:justify-end">
            {actionMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setActionMode(null);
                    setReason("");
                    setReturnDay("");
                  }}
                  disabled={isUpdating}
                >
                  {t("cancel")}
                </Button>
                <Button
                  variant={actionMode === "absent" ? "default" : "destructive"}
                  onClick={handleConfirmReason}
                  disabled={!reasonValid || isUpdating}
                >
                  {isUpdating ? (
                    <LottieLoader width={20} height={20} />
                  ) : actionMode === "reject" ? (
                    <X className="w-4 h-4 mr-2" />
                  ) : actionMode === "deregister" ? (
                    <LogOut className="w-4 h-4 mr-2" />
                  ) : actionMode === "absent" ? (
                    <Plane className="w-4 h-4 mr-2" />
                  ) : (
                    <ShieldOff className="w-4 h-4 mr-2" />
                  )}
                  {actionMode === "reject"
                    ? t("confirmReject")
                    : actionMode === "deregister"
                      ? t("confirmDeregister")
                      : actionMode === "absent"
                        ? t("confirmAbsent")
                        : t("confirmSuspend")}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>
                  {t("close")}
                </Button>
                {actions.secondary && (
                  <Button
                    variant="destructive"
                    onClick={() => perform(actions.secondary!)}
                    disabled={isUpdating}
                  >
                    {ACTION_ICONS[actions.secondary]}
                    {actionLabel(actions.secondary)}
                  </Button>
                )}
                {actions.menu.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" disabled={isUpdating}>
                        {t("moreActions")}
                        <ChevronDown className="w-4 h-4 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {actions.menu.map((action, index) => (
                        <Fragment key={action}>
                          {/* The two actions that take a driver off the work
                              sit apart from the temporary one. */}
                          {index > 0 && action === "suspend" && actions.menu[0] === "markAbsent" && (
                            <DropdownMenuSeparator />
                          )}
                          <DropdownMenuItem
                            variant={action === "suspend" || action === "remove" ? "destructive" : "default"}
                            onSelect={() => perform(action)}
                          >
                            {ACTION_ICONS[action]}
                            {actionLabel(action)}
                          </DropdownMenuItem>
                        </Fragment>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {actions.primary && (
                  <Button
                    onClick={() => perform(actions.primary!)}
                    disabled={isUpdating}
                    className={
                      actions.primary === "approve"
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : undefined
                    }
                  >
                    {isUpdating && actions.primary === "approve" ? (
                      <LottieLoader width={20} height={20} />
                    ) : (
                      ACTION_ICONS[actions.primary]
                    )}
                    {actionLabel(actions.primary)}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogFooter>
      {onSaveFile && onAddVehicle && editing && (
        <CarrierFileEditor
          open={editing}
          onOpenChange={setEditing}
          application={application}
          onSave={onSaveFile}
          onAddVehicle={onAddVehicle}
          isSaving={isUpdating}
        />
      )}
    </div>
  );
}
