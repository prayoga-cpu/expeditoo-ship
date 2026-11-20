"use client";

import { useTranslations } from "next-intl";
import {
  CONVERSATION_FILTERS,
  type ConversationCounts,
  type ConversationFilter,
} from "@/lib/conversation-filter";
import { cn } from "@/lib/utils";
import { useConversationCounts } from "../hooks/useConversationCounts";
import { useConversationFilter } from "../hooks/useConversationFilter";

interface ConversationFiltersProps {
  value: ConversationFilter;
  onChange: (filter: ConversationFilter) => void;
  /** Absent while the counts load, or if they cannot be read: no numbers, same chips. */
  counts?: ConversationCounts;
}

/**
 * Conversations by the state of their job, one chip each with its count
 * (client feedback 2026-11-19, #26). One row that scrolls sideways on a phone
 * rather than wrapping: the list below is what the screen is for.
 *
 * The chips come from `CONVERSATION_FILTERS`, so the row cannot offer a filter
 * the server refuses, nor miss one it accepts.
 */
export function ConversationFilters({ value, onChange, counts }: ConversationFiltersProps) {
  const t = useTranslations("messages.tabs");

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"
    >
      {CONVERSATION_FILTERS.map((filter) => {
        const active = filter === value;
        return (
          <button
            key={filter}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(filter)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary/40"
            )}
          >
            {t(filter)}
            {counts ? (
              <span
                className={cn(
                  "font-mono tabular-nums",
                  active ? "text-primary-foreground/80" : "text-muted-foreground"
                )}
              >
                {counts[filter]}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The row, wired: the filter from the URL, the counts from their own read.
 * A failed count costs the numbers and nothing else — the chips still filter.
 */
export function ConversationFilterBar() {
  const { filter, setFilter } = useConversationFilter();
  const { data: counts } = useConversationCounts();

  return <ConversationFilters value={filter} onChange={setFilter} counts={counts} />;
}
