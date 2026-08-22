"use client";

import { useTranslations } from "next-intl";
import { LP_CARD, LP_GRID_4 } from "./styles";

export interface MarketingCard {
  title: string;
  desc: string;
}

function isCard(value: unknown): value is MarketingCard {
  if (typeof value !== "object" || value === null) return false;
  const card = value as Record<string, unknown>;
  return typeof card.title === "string" && typeof card.desc === "string";
}

/**
 * Numbered card row, fed from a translated array.
 *
 * Shares the shape of the landing's "how it works" row on purpose: a visitor
 * arriving on `/verification` from the footer should not feel they have left
 * the site.
 */
export function MarketingCardGrid({
  namespace,
  itemsKey = "items",
  numbered = true,
}: {
  namespace: string;
  itemsKey?: string;
  numbered?: boolean;
}) {
  const t = useTranslations(namespace);
  const raw = t.raw(itemsKey);
  const cards = Array.isArray(raw) ? raw.filter(isCard) : [];

  return (
    <div className={LP_GRID_4}>
      {cards.map((card, index) => (
        <div key={index} className={`${LP_CARD} box-border gap-3`}>
          {numbered ? (
            <span className="font-mono text-xs text-[var(--lp-bluelink)]">
              {String(index + 1).padStart(2, "0")}
            </span>
          ) : null}
          <span className="text-[16.5px] font-semibold tracking-[-0.01em]">
            {card.title}
          </span>
          <span className="text-sm leading-[1.6] text-[var(--lp-muted)]">
            {card.desc}
          </span>
        </div>
      ))}
    </div>
  );
}
