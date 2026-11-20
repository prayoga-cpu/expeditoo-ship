"use client";

import Link from "next/link";
import type { InfiniteData, UseInfiniteQueryResult } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { Skeleton } from "@/components/ui/skeleton";

interface PagedListProps<P, T> {
  query: UseInfiniteQueryResult<InfiniteData<P>, unknown>;
  itemsOf: (page: P) => T[];
  renderItem: (item: T) => React.ReactNode;
  empty: { icon: LucideIcon; title: string; description: string };
  /** Where an empty list sends the reader: the profile they came to read about. */
  emptyHref: string;
  testId: string;
}

/**
 * One section of « Demandes et messages »: loading, failed, empty, or a list
 * with « Afficher la suite ». Every branch has something to press
 * (CLAUDE.md gotchas 9 and 24).
 */
export function PagedList<P, T>({
  query,
  itemsOf,
  renderItem,
  empty,
  emptyHref,
  testId,
}: PagedListProps<P, T>) {
  const t = useTranslations("admin.userActivity");

  if (query.isLoading) {
    return (
      <div className="space-y-3" data-testid={`${testId}-loading`}>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return <LoadErrorState onRetry={() => query.refetch()} />;
  }

  const items = query.data.pages.flatMap(itemsOf);
  if (items.length === 0) {
    return (
      <CenteredEmptyState icon={empty.icon} title={empty.title} description={empty.description}>
        <Button asChild variant="outline" className="mt-4">
          <Link href={emptyHref}>{t("backToUsers")}</Link>
        </Button>
      </CenteredEmptyState>
    );
  }

  return (
    <div className="space-y-3" data-testid={testId}>
      <ul className="space-y-3">{items.map(renderItem)}</ul>
      {query.hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage && <LottieLoader width={20} height={20} />}
            {t("loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
