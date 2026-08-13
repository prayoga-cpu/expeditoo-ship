"use client";

import { Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  className?: string;
  size?: number;
}

export function VerifiedBadge({ className, size = 16 }: VerifiedBadgeProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center justify-center bg-blue-500 text-white rounded-full ml-1",
              className
            )}
            style={{ width: size, height: size }}
            aria-label="Verified User"
          >
            <Check
              strokeWidth={4}
              style={{ width: size * 0.6, height: size * 0.6 }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="text-xs bg-foreground text-background"
        >
          <p>Verified User</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
