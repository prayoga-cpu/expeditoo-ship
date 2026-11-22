"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface RowDeleteButtonProps {
  /** Who the conversation is with — read out with the button's name. */
  name: string;
  onDelete: () => void;
}

/**
 * Deleting a conversation without a touchscreen.
 *
 * The only way was a swipe to the left, which a mouse can imitate by dragging
 * and a keyboard cannot do at all (2.95.0). This is the same action, reached
 * by Tab or by pointing at the row, and it keeps the swipe's two steps: the
 * swipe reveals « Supprimer » and a second touch confirms, so the first press
 * here only arms the button and the second deletes. Leaving it — Escape, or
 * focus moving on — disarms it.
 */
export function RowDeleteButton({ name, onDelete }: RowDeleteButtonProps) {
  const t = useTranslations("messages.item");
  const [armed, setArmed] = useState(false);

  const press = (event: React.MouseEvent) => {
    // The row itself is a link to the thread.
    event.stopPropagation();
    event.preventDefault();
    if (!armed) return setArmed(true);
    setArmed(false);
    onDelete();
  };

  return (
    <button
      type="button"
      data-testid="row-delete"
      aria-label={armed ? t("deleteConfirm", { name }) : t("deleteNamed", { name })}
      onClick={press}
      onBlur={() => setArmed(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setArmed(false);
      }}
      className={cn(
        "hidden md:flex shrink-0 items-center gap-1 self-center rounded-md px-2 py-1.5 text-xs font-medium transition-opacity",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        armed
          ? "bg-destructive text-white opacity-100"
          : "text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
      )}
    >
      <Trash2 aria-hidden className="h-4 w-4" />
      {armed && <span>{t("deleteConfirmShort")}</span>}
    </button>
  );
}
