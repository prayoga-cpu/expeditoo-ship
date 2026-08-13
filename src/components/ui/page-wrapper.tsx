import { cn } from "@/lib/utils";

interface PageWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /**
   * Remove default padding (for pages that need full-bleed content)
   */
  noPadding?: boolean;
}

/**
 * Standardized page wrapper with consistent spacing
 * 
 * Features:
 * - Responsive padding (smaller on mobile, larger on desktop)
 * - Responsive padding (smaller on mobile, larger on desktop)
 * - Centered content with max-width
 * 
 * Usage:
 * ```tsx
 * <PageWrapper>
 *   <YourContent />
 * </PageWrapper>
 * ```
 */
export function PageWrapper({
  children,
  noPadding = false,
  className,
  ...props
}: PageWrapperProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        // !noPadding && "p-4 md:p-6 md:pb-6", // Removed to prevent double padding with Layout
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
