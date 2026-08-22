"use client";

import { useTranslations } from "next-intl";
import { LP_BODY, LP_H3, LP_PROSE_CONTAINER } from "./styles";

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

/**
 * Sections come out of the message catalogue rather than the component, so the
 * French and English texts sit side by side in `messages/*.json` and a missing
 * clause shows up in a key diff instead of by reading both pages.
 */
function isLegalSection(value: unknown): value is LegalSection {
  if (typeof value !== "object" || value === null) return false;
  const section = value as Record<string, unknown>;
  const isStringList = (list: unknown) =>
    list === undefined ||
    (Array.isArray(list) && list.every((entry) => typeof entry === "string"));

  return (
    typeof section.title === "string" &&
    isStringList(section.paragraphs) &&
    isStringList(section.items)
  );
}

/**
 * `raw` is typed `unknown` and reaches into JSON the compiler never saw, so a
 * malformed catalogue is a runtime possibility rather than a type error. A
 * legal page that renders its remaining sections is better than one that
 * throws and shows none of them.
 */
function readSections(raw: unknown): LegalSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isLegalSection);
}

export function LegalDocument({ namespace }: { namespace: string }) {
  const t = useTranslations(namespace);
  const sections = readSections(t.raw("sections"));

  return (
    <div className={`${LP_PROSE_CONTAINER} flex flex-col gap-9 pb-4`}>
      <span className="font-mono text-[11px] tracking-[0.14em] text-[var(--lp-faint)]">
        {t("lastUpdated")}
      </span>

      {sections.map((section, index) => (
        // Keyed by position, not by text: translators edit this copy, and two
        // sections sharing a title would collide on a text key.
        <section key={index} className="flex flex-col gap-3">
          <h2 className={LP_H3}>
            {/* Numbered from position: inserting a clause must not mean
                renumbering every heading after it in two languages. */}
            <span className="mr-2 font-mono text-[13px] text-[var(--lp-dim)]">
              {String(index + 1).padStart(2, "0")}
            </span>
            {section.title}
          </h2>

          {section.paragraphs?.map((paragraph, position) => (
            <p key={position} className={LP_BODY}>
              {paragraph}
            </p>
          ))}

          {section.items?.length ? (
            <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
              {section.items.map((item, position) => (
                <li key={position} className={LP_BODY}>
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}
