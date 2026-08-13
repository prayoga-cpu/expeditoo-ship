import Link from "next/link";
import { MapPin, Clock, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import type { Delivery } from "../types";

/**
 * Pure UI component for rendering a single delivery card
 * Follows Single Responsibility Principle - only handles presentation
 *
 * @param delivery - Delivery data object
 * @param index - Index for staggered animation
 */
interface DeliveryCardProps {
  delivery: Delivery;
  index: number;
}

export function DeliveryCard({ delivery, index }: DeliveryCardProps) {
  return (
    <Link href={`/deliveries/${delivery.id}`}>
      <div
        style={{
          animation: `fadeIn 0.4s ease-out ${index * 0.08}s both`,
        }}
        className="group bg-card rounded-2xl p-5 border border-border cursor-pointer hover:border-primary/40 transition-smooth hover:shadow-md hover:shadow-primary/10 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-linear-to-br from-primary/0 via-primary/0 to-accent-green/0 group-hover:from-primary/5 group-hover:via-primary/0 group-hover:to-accent-green/5 transition-smooth pointer-events-none" />

        <div className="relative z-10">
          <div className="flex justify-between items-start gap-3 mb-4">
            <div className="flex-1">
              <h3 className="font-bold text-foreground text-lg group-hover:text-primary transition-smooth truncate">
                {delivery.title}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2 group-hover:text-foreground/70 transition-smooth">
                <MapPin className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {delivery.origin} → {delivery.destination}
                </span>
              </div>
            </div>
            <Badge className="bg-primary/90 text-primary-foreground font-bold px-3 py-1 group-hover:bg-primary transition-smooth shrink-0">
              {delivery.price}€
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground group-hover:text-foreground/70 transition-smooth">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{delivery.dates}</span>
            </div>

            <div className="h-px bg-linear-to-r from-border via-border to-transparent group-hover:from-primary/20 group-hover:via-primary/10 group-hover:to-transparent transition-smooth" />

            <div className="flex justify-between items-center">
              <StatusBadge status={delivery.status} />
              {delivery.driver && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground/70 transition-smooth">
                  <Zap className="w-3 h-3" />
                  <span>{delivery.driver}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
