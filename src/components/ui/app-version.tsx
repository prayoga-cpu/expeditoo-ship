"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";

/**
 * Which release you are looking at, and the way to read what it changed.
 *
 * `APP_VERSION` existed for a month and was rendered by nothing — it was kept
 * in step with `package.json` and `CHANGELOG.md` by a test (AGENTS.md §8) and
 * then never shown, so "which version is this?" was a question only a
 * maintainer with a terminal could answer. `/changelog` had the same problem
 * from the other side: a real page, linked from one footer column, that
 * nothing told you was about the build in front of you.
 *
 * Geist Mono because the design system gives numerals to the mono face, and
 * because a version is read digit by digit rather than as a word.
 *
 * Palette comes from the caller, not from here: the landing chrome is written
 * against the `--lp-*` tokens, which only resolve inside a `.lp` root, so a
 * component that hardcoded `text-muted-foreground` would render invisible in
 * the footer. `cn` lets the caller's colour win over the app default — the
 * same split `LangToggle` documents.
 */
export function AppVersionLink({ className }: { className?: string }) {
  const t = useTranslations("common.version");
  // Named in full for assistive tech: "v2.36.0" alone is a string of digits,
  // and nothing in it says the link goes to the release notes.
  const label = t("label", { version: APP_VERSION });

  return (
    <Link
      href="/changelog"
      aria-label={label}
      title={label}
      className={cn(
        "whitespace-nowrap font-mono text-[11px] tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
    >
      v{APP_VERSION}
    </Link>
  );
}
