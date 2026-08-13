import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CenteredEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  /**
   * 'page' variant applies the standard full-page height/centering used by PageLoader.
   * Use this for main page empty states.
   */
  variant?: "default" | "page";
}

// Standardized height classes - use h-full to fill parent container
const pageHeightClass = "h-full flex-1 w-full min-h-[400px]";

export function CenteredEmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
  variant = "default",
  ...props
}: CenteredEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center w-full p-8 text-center animate-fade-in", 
        variant === "page" ? pageHeightClass : "h-full flex-1",
        className
      )}
      {...props}
    >
      <div className="flex flex-col items-center max-w-sm">
        {Icon && (
          <div className="bg-muted/50 p-4 rounded-full mb-4 ring-1 ring-border/50">
            <Icon className="w-8 h-8 text-muted-foreground/80" />
          </div>
        )}
        <h3 className="text-lg font-semibold text-foreground tracking-tight">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 text-balance leading-relaxed">
            {description}
          </p>
        )}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}
