"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import {
  Check,
  ExternalLink,
  LogOut,
  Plane,
  RotateCcw,
  ShieldOff,
  UserCheck,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { useCarrierDocumentViewer } from "../hooks/useCarrierApplications";
import type {
  CarrierApplication,
  CarrierApplicationDocument,
  CarrierApplicationVehicle,
  CarrierAvailabilityRequest,
} from "../api/carriers.api";

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
  /** Called after an action succeeded; the list closes the dialog. */
  onDone: () => void;
  onClose: () => void;
}

type ReasonAction = "reject" | "suspend" | "deregister" | "absent";

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
  onDone,
  onClose,
}: CarrierApplicationDetailProps) {
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
  const canSuspend = application.status === "approved";
  const absent = isAbsent(application);
  const notProvided = t("notProvided");

  const runAction = async (action: () => Promise<unknown>) => {
    try {
      await action();
      onDone();
    } catch {
      // Failure toast already raised by the mutation hook.
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
        </div>

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
            <Field label={t("companyName")} value={application.companyName} />
            <Field label={t("siret")} value={application.siret} mono />
            <Field
              label={t("vatNumber")}
              value={application.vatNumber ?? notProvided}
              mono={application.vatNumber !== null}
            />
            <Field
              label={t("legalForm")}
              value={application.legalForm ?? notProvided}
            />
            <Field label={t("contactPhone")} value={application.contactPhone} />
            <Field
              label={t("address")}
              value={`${application.addressLine}, ${application.postalCode} ${application.city}`}
            />
          </div>
        </div>

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
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
                {canSuspend &&
                  (absent ? (
                    <Button
                      variant="outline"
                      onClick={() =>
                        void runAction(() =>
                          onSetAvailability({
                            id: application.id,
                            input: { absent: false },
                          }),
                        )
                      }
                      disabled={isUpdating}
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      {t("endAbsence")}
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setActionMode("absent")}
                      disabled={isUpdating}
                    >
                      <Plane className="w-4 h-4 mr-2" />
                      {t("markAbsent")}
                    </Button>
                  ))}
                {canSuspend && (
                  <Button
                    variant="destructive"
                    onClick={() => setActionMode("suspend")}
                    disabled={isUpdating}
                  >
                    <ShieldOff className="w-4 h-4 mr-2" />
                    {t("suspend")}
                  </Button>
                )}
                {(canSuspend || application.status === "suspended") && (
                  <Button
                    variant="destructive"
                    onClick={() => setActionMode("deregister")}
                    disabled={isUpdating}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {t("deregister")}
                  </Button>
                )}
                {application.status === "suspended" && (
                  <Button
                    onClick={() => void runAction(() => onReinstate(application.id))}
                    disabled={isUpdating}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {t("reinstate")}
                  </Button>
                )}
                {canReview && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => setActionMode("reject")}
                      disabled={isUpdating}
                    >
                      <X className="w-4 h-4 mr-2" />
                      {t("reject")}
                    </Button>
                    <Button
                      onClick={() =>
                        void runAction(() => onApprove(application.id))
                      }
                      disabled={isUpdating}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isUpdating ? (
                        <LottieLoader width={20} height={20} />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      {t("approve")}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </DialogFooter>
    </div>
  );
}
