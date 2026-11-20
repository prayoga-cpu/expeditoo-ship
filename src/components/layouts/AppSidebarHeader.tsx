import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandMark, BrandWordmark } from "@/components/ui/brand-mark";
import { AccessSwitcher } from "./AccessSwitcher";
import { RAIL } from "./use-sidebar-rail";

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
      <div className={cn("flex items-center justify-start px-6 h-[57px] shrink-0", RAIL.center)}>
        {/* The shared `BrandWordmark` rather than a hand-written heading, so
            the sidebar, the marketing chrome and the splash all render one
            component and cannot drift apart again. No `tagline`: the app
            shell drops the "TRANSPORT" sub-line (feedback ticket
            gQND7ETKONmwr0V3RusMY); marketing opts back into it. */}
        {/* In the rail (`use-sidebar-rail.ts`) there is room for the mark and
            not the name: 64px against a 109px lockup. The name is hidden
            rather than unmounted so the link keeps saying where it goes. */}
        <Link href={href} className="relative flex items-center" title="Expeditop">
          <span className={RAIL.srOnly}>
            <BrandWordmark size={28} />
          </span>
          <span className={RAIL.only}>
            <BrandMark size={28} />
          </span>
        </Link>
      </div>
      {/* The logo row keeps its fixed height so the sidebar lines up with the
          content header in every layout; the subtitle hangs below it. It used
          to be pulled back up with -mt-4, which sat it on top of the wordmark's
          TRANSPORT line.

          The access switcher sits on the same shelf. It belongs here rather
          than in each layout because all three sidebars — app, driver, admin
          — render this header, and "which access am I browsing with" is the
          same question in all three. Wrapped so a layout that also passes a
          subtitle gets both, side by side, instead of two stacked rows.

          The row keeps its height whether or not it has resolved, so the nav
          below does not jump down the moment the session arrives.

          Gone in the rail: the badge is wider than the rail is. Each shell's
          header carries the switcher then (`WHEN_RAIL`). */}
      <div className={cn("flex min-h-[26px] flex-wrap items-center gap-2 px-6 pb-5", RAIL.hidden)}>
        <AccessSwitcher />
        {subtitle && (
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}
