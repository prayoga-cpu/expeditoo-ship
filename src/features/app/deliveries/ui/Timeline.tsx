import {
  Package,
  UserCheck,
  PackageCheck,
  Truck,
  CircleCheck,
  CircleX,
  BadgeCheck,
  Hourglass,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ShipmentStatus } from "../api/deliveries.api";
import type { TimelineConfirmation, TimelineStep } from "../types";

const STATUS_ICON: Record<ShipmentStatus, LucideIcon> = {
  PENDING: Package,
  ASSIGNED: UserCheck,
  PICKED_UP: PackageCheck,
  IN_TRANSIT: Truck,
  DELIVERED: CircleCheck,
  CANCELLED: CircleX,
};

/**
 * The recorded status history of a shipment, oldest first.
 *
 * Two facts per step where both exist: the transporter moved it, and the
 * client did or did not attest it. They are separate lines because they are
 * separate facts — the second is never inferred from the first.
 */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <div className="space-y-0">
      {steps.map((step, index) => {
        const Icon = STATUS_ICON[step.status];

        return (
          <div key={index} className="relative flex gap-4 pb-6 last:pb-0">
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "absolute left-5 top-11 bottom-0 w-0.5 rounded-full",
                  step.step === "completed" ? "bg-primary" : "bg-border"
                )}
              />
            )}

            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4",
                step.status === "CANCELLED"
                  ? "bg-destructive/15 text-destructive ring-destructive/10"
                  : step.step === "completed"
                    ? "bg-primary text-primary-foreground ring-primary/15"
                    : step.step === "active"
                      ? "bg-success text-white ring-success/20"
                      : "bg-muted text-muted-foreground ring-muted"
              )}
            >
              <Icon className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <h4 className="font-semibold text-foreground">{step.label}</h4>
              <p className="text-sm text-muted-foreground">{step.date}</p>
              {step.note && (
                <p className="mt-1 text-sm leading-relaxed text-foreground/70">
                  {step.note}
                </p>
              )}
              <ConfirmationLine confirmation={step.confirmation} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** The client's half of a step. Absent where no attestation is asked for. */
function ConfirmationLine({
  confirmation,
}: {
  confirmation: TimelineConfirmation | null;
}) {
  const t = useTranslations("deliveries.confirmation");
  if (!confirmation) return null;

  const confirmed = confirmation.state === "confirmed";
  const Icon = confirmed ? BadgeCheck : Hourglass;

  return (
    <p
      className={cn(
        "mt-1.5 flex flex-wrap items-center gap-1.5 text-xs",
        confirmed ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>
        {!confirmed
          ? t("awaitingClient")
          : confirmation.role === "operator"
            ? t("confirmedByOperator")
            : t("confirmedByClient")}
      </span>
      {confirmed && confirmation.channel && (
        <span className="text-muted-foreground">
          · {t(`channel.${confirmation.channel}`)}
        </span>
      )}
      {confirmed && confirmation.date && (
        <span className="text-muted-foreground">· {confirmation.date}</span>
      )}
    </p>
  );
}
