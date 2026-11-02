"use client";

import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { cn } from "@/lib/utils";

interface LoadErrorStateProps {
  /** Reads again. Required: a failure with nothing to press is a dead end. */
  onRetry: () => void;
  title?: string;
  description?: string;
  /** Somewhere else to go when trying again is not the answer. */
  back?: { href: string; label: string };
  /**
   * `page` and `default` are the centred empty state; `inline` is one line
   * for a card or a section that failed inside a page that did not.
   */
  variant?: "page" | "default" | "inline";
  className?: string;
}

/**
 * A read that failed, with the way out (docs/specs/no_dead_ends_spec.md §4).
 *
 * CLAUDE.md gotcha 9 asked every query surface for an `isError` branch; this
 * is what goes in it, so a failure is never a sentence with nothing to press.
 * `src/__tests__/no-dead-ends.test.ts` fails on a failure branch that offers
 * no retry.
 */
export function LoadErrorState({
  onRetry,
  title,
  description,
  back,
  variant = "default",
  className,
}: LoadErrorStateProps) {
  const t = useTranslations("common.loadError");

  if (variant === "inline") {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive",
          className
        )}
      >
        <span>{title ?? t("title")}</span>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          <RotateCw className="h-3.5 w-3.5" />
          {t("retry")}
        </Button>
      </div>
    );
  }

  return (
    <CenteredEmptyState
      variant={variant}
      icon={AlertTriangle}
      title={title ?? t("title")}
      description={description ?? t("description")}
      className={className}
      role="alert"
    >
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" onClick={onRetry}>
          <RotateCw className="h-4 w-4" />
          {t("retry")}
        </Button>
        {back && (
          <Button asChild variant="ghost">
            <Link href={back.href}>{back.label}</Link>
          </Button>
        )}
      </div>
    </CenteredEmptyState>
  );
}
