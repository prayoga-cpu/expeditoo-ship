import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface StatusBadgeProps {
  status:
  | "pending"
  | "accepted"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "cancelled";
  className?: string;
}

const statusColor = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  picked_up: "bg-purple-100 text-purple-800",
  in_transit: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const t = useTranslations("common.status");
  const color = statusColor[status];

  return (
    <span
      className={cn(
        "px-3 py-1 rounded-full text-sm font-medium",
        color,
        className,
      )}
    >
      {t(status)}
    </span>
  );
}
