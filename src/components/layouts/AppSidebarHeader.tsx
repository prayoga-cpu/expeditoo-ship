import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandWordmark } from "@/components/ui/brand-mark";
import { SidebarRoleBadge } from "./SidebarRoleBadge";

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
        {/* The shared EXPEDITOO / TRANSPORT lockup rather than a hand-written
            heading, so the sidebar, the marketing chrome and the splash all
            render one component and cannot drift apart again. */}
        <Link href={href} className="flex items-center">
          <BrandWordmark size={28} />
        </Link>
      </div>
      {/* The logo row keeps its fixed height so the sidebar lines up with the
          content header in every layout; the subtitle hangs below it. It used
          to be pulled back up with -mt-4, which sat it on top of the wordmark's
          TRANSPORT line.

          The role badge sits on the same shelf. It belongs here rather than in
          each layout because all three sidebars — app, driver, admin — render
          this header, and "which access am I browsing with" is the same
          question in all three. Wrapped so a layout that also passes a
          subtitle gets both, side by side, instead of two stacked rows.

          The row keeps its height whether or not the badge has resolved, so
          the nav below does not jump down the moment the session arrives. */}
      <div className="flex min-h-[26px] flex-wrap items-center gap-2 px-6 pb-5">
        <SidebarRoleBadge />
        {subtitle && (
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
