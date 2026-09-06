"use client";

import { Fragment, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { ReleaseDTO } from "@/server/services/changelog.service";
import type { ReleaseTag } from "@/lib/changelog";
import { LP_BODY, LP_H3, LP_PROSE_CONTAINER } from "./styles";

/**
 * The public release history at `/changelog`, read from `CHANGELOG.md`
 * (AGENTS.md §8). One card per release, newest first.
 *
 * The releases arrive as props from a statically rendered server page, so
 * nothing here fetches and there is no loading or error state to get wrong.
 */

/**
 * Every tag reads from the `--lp-*` palette, which is redefined under
 * `.dark .lp`, so light and dark both come for free — a raw hex here would
 * have been legible in exactly one of them.
 */
const TAG_STYLES: Record<ReleaseTag, string> = {
  feat: "bg-[var(--lp-greenbg)] text-[var(--lp-green)]",
  fix: "bg-[color-mix(in_oklab,var(--lp-amber)_12%,transparent)] text-[var(--lp-ambertext)]",
  ux: "bg-[color-mix(in_oklab,var(--lp-bluelink)_12%,transparent)] text-[var(--lp-bluetext)]",
  infra: "bg-[var(--lp-chip)] text-[var(--lp-dim)]",
};

/**
 * The bullets are markdown, and they were written as markdown on purpose —
 * every one opens with a bold sentence naming the change. Rendering them raw
 * would print the asterisks, which is precisely the bug the sibling repo had
 * to fix on its own changelog page.
 *
 * This handles the three things the file actually uses — `**bold**`, `` `code` ``
 * and nothing else — by building React nodes. It never touches
 * `dangerouslySetInnerHTML`: the source is a repo file today, but a renderer
 * that cannot inject HTML stays safe if that ever stops being true.
 */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function renderInline(text: string): ReactNode {
  return text.split(INLINE).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-[var(--lp-text)]">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded-[5px] bg-[var(--lp-chip)] px-1.5 py-0.5 font-mono text-[0.9em] text-[var(--lp-text)]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
}

function ReleaseCard({ release }: { release: ReleaseDTO }) {
  const t = useTranslations("marketing.changelog");
  const locale = useLocale();

  const date = new Date(release.releasedAt).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    // The header carries no time, so every release is stored at midnight UTC.
    // Formatting in the reader's zone would print the previous day for anyone
    // west of Greenwich.
    timeZone: "UTC",
  });

  return (
    <article className="flex flex-col gap-4 border-t border-[var(--lp-line)] pt-8 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className={LP_H3}>{release.version}</h2>
        <span
          className={`rounded-full px-2.5 py-1 font-mono text-[11px] tracking-[0.08em] ${TAG_STYLES[release.tag]}`}
        >
          {t(`tags.${release.tag}`)}
        </span>
        <time
          dateTime={release.releasedAt.slice(0, 10)}
          className="text-[13px] text-[var(--lp-faint)]"
        >
          {date}
        </time>
      </div>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {release.entries.map((entry, index) => (
          <li key={index} className={`${LP_BODY} flex gap-3`}>
            <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[var(--lp-faint)]" />
            <span className="min-w-0">{renderInline(entry)}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function ChangelogView({ releases }: { releases: ReleaseDTO[] }) {
  const t = useTranslations("marketing.changelog");

  if (releases.length === 0) {
    return (
      <div className={LP_PROSE_CONTAINER}>
        <p className={LP_BODY}>{t("empty")}</p>
      </div>
    );
  }

  return (
    <div className={`${LP_PROSE_CONTAINER} flex flex-col gap-8`}>
      {releases.map((release) => (
        <ReleaseCard key={release.version} release={release} />
      ))}
    </div>
  );
}
