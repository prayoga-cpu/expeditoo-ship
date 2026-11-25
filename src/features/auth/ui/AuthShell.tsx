import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BrandWordmark } from "@/components/ui/brand-mark";
import { LANDING_IMAGES } from "@/features/marketing/ui/landing-images";

/**
 * The one frame every signed-out screen sits in: sign-in, sign-up, the two
 * password screens, email verification and the welcome fork.
 *
 * Each of those pages used to carry its own copy of a tinted gradient, two
 * pulsing blurred discs and a translucent card. This is the form on the page
 * itself, left-aligned under the wordmark, with the home page's own photograph
 * beside it from `lg` up. Nothing here animates, and nothing here is
 * translucent, so a field is the same colour in both themes.
 */
export function AuthShell({
  children,
  below,
}: {
  children: ReactNode;
  /** A line under the form — the support address on the verification page. */
  below?: ReactNode;
}) {
  const t = useTranslations("marketing");
  const photo = LANDING_IMAGES.hero;

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)]">
      <div className="flex min-w-0 flex-col px-5 py-6 sm:px-10 lg:px-16">
        <Link
          href="/"
          aria-label="EXPEDITOP"
          className="w-fit rounded-md text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <BrandWordmark size={32} />
        </Link>

        <main className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-[26rem]">
            {children}
            {below}
          </div>
        </main>
      </div>

      <aside className="relative hidden overflow-hidden bg-[#0a2348] lg:block">
        {/* No `priority`: it emits a preload link whatever the display, so a
            phone fetched a photograph it never shows. Lazy, the browser skips
            it while the aside is `display: none` and loads it at once from
            `lg` up, where it is in view. */}
        <Image
          src={photo.src}
          alt=""
          fill
          loading="lazy"
          sizes="(min-width: 1024px) 45vw, 1px"
          className="object-cover opacity-55"
        />
        <p className="absolute inset-x-0 bottom-0 max-w-[30rem] p-10 text-lg leading-snug font-medium text-white xl:p-14 xl:text-xl">
          {t("hero.note")}
        </p>
      </aside>
    </div>
  );
}

/**
 * A plain note inside an auth screen: where the code went, what happens next.
 * `tone="danger"` is for a refusal the screen itself states (an expired link);
 * a refusal from the server goes through `AuthErrorNotice`.
 */
export function AuthNote({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "danger";
  className?: string;
}) {
  const toneClass =
    tone === "danger"
      ? "border-destructive/30 text-destructive"
      : "border-border text-muted-foreground";

  return (
    <div className={`rounded-md border bg-muted/40 p-3 text-sm leading-relaxed ${toneClass} ${className}`}>
      {children}
    </div>
  );
}
