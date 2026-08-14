import {
  Package,
  UserCheck,
  PackageCheck,
  Truck,
  CircleCheck,
  CircleX,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ShipmentStatus } from "../api/deliveries.api";
import type { TimelineStep } from "../types";

const STATUS_ICON: Record<ShipmentStatus, LucideIcon> = {
  PENDING: Package,
  ASSIGNED: UserCheck,
  PICKED_UP: PackageCheck,
  IN_TRANSIT: Truck,
  DELIVERED: CircleCheck,
  CANCELLED: CircleX,
};

/** The recorded status history of a shipment, oldest first. */
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
