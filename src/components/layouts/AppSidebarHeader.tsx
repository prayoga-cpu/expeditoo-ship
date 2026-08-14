import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/ui/brand-mark";

interface AppSidebarHeaderProps {
  /**
   * Destination URL when logo is clicked
   * @default "/home"
   */
  href?: string;
  /**
   * Optional subtitle to display below the logo (e.g. "Espace Chauffeur")
   */
  subtitle?: string;
  /**
   * Additional className
   */
  className?: string;
}

export function AppSidebarHeader({
  href = "/home",
  subtitle,
  className,
}: AppSidebarHeaderProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-start px-6 h-[57px] shrink-0">
        <Link href={href} className="flex items-center gap-2.5">
          <BrandMark size={28} />
          <h1 className="text-2xl font-bold text-primary">EXPEDITOO</h1>
        </Link>
      </div>
      {subtitle && (
        <div className="px-6 -mt-4 pb-6">
          <p className="text-sm font-medium text-muted-foreground">
            {subtitle}
          </p>
        </div>
      )}
    </div>
  );
}
