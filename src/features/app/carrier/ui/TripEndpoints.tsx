import { Circle, CircleDot } from "lucide-react";

/** The two ends of a run as pinned lines, as the « Terminés » cards draw them. */
export function TripEndpoints({ from, to }: { from: string; to: string }) {
  return (
    <div className="space-y-1 text-sm">
      <div className="flex items-center gap-2">
        <Circle className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{from}</span>
      </div>
      <div className="flex items-center gap-2">
        <CircleDot className="h-3 w-3 shrink-0 text-primary" />
        <span className="truncate">{to}</span>
      </div>
    </div>
  );
}
