"use client";

import Link from "next/link";
import { Search, MessageSquare, MapPin, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { MessageRow } from "./MessageRow";
import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import type { ListingChip, Message } from "../types";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Pure UI component for displaying messages list
 * Follows Single Responsibility Principle - only handles presentation
 * Business logic handled by useMessages hook in page
 */
interface MessagesProps {
  messages: Message[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onDeleteConversation?: (id: string) => void;
  isLoading?: boolean;
  basePath?: string;
  /** Jobs offered as one-tap filters under the search box (§D5). */
  listingChips?: ListingChip[];
  listingFilter?: string | null;
  onListingFilterChange?: (listingId: string | null) => void;
}

export function Messages({
  messages,
  searchQuery,
  onSearchChange,
  onDeleteConversation,
  isLoading = false,
  basePath = "/messages",
  listingChips = [],
  listingFilter = null,
  onListingFilterChange,
}: MessagesProps) {
  const t = useTranslations("messages");
  const picked = listingChips.find((chip) => chip.id === listingFilter) ?? null;

  if (isLoading) {
    const isDriver = basePath.includes("/driver");
    return (
      <PageLoader
        className={cn(isDriver && "xl:min-h-[100vh]")}
      />
    );
  }

  return (
    <div className="h-full flex flex-col   mx-auto w-full">
      {/* Header */}
      <div className="pb-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur">
        <div className="hidden md:flex items-center justify-between mb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {t("title")}
          </h1>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder={t("search")}
            className="pl-12 h-10 rounded-full text-sm"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        {listingChips.length > 0 && onListingFilterChange ? (
          <div className="mt-3 space-y-1.5">
            <p className="text-xs text-muted-foreground">{t("chips.label")}</p>
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {listingChips.map((chip) => {
                const active = chip.id === listingFilter;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    aria-pressed={active}
                    title={chip.title}
                    onClick={() => onListingFilterChange(active ? null : chip.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card text-foreground hover:border-primary/40"
                    )}
                  >
                    <MapPin className="h-3 w-3" aria-hidden />
                    {chip.route}
                    {active ? <X className="h-3 w-3" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Tabs */}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {messages.length > 0 ? (
          <div>
            {messages.map((message) => (
              <MessageRow
                key={message.id}
                message={message}
                onDelete={onDeleteConversation}
                basePath={basePath}
              />
            ))}
          </div>
        ) : picked ? (
          // A job picked from the chips with no thread yet: say so, and on the
          // viewer's own request offer the carriers already on that route.
          <CenteredEmptyState
            variant="page"
            icon={MapPin}
            title={t("chips.emptyTitle", { route: picked.route })}
            description={
              picked.own ? t("chips.emptyOwn") : t("chips.emptyOther")
            }
          >
            <Button asChild variant="outline">
              <Link
                href={
                  picked.own
                    ? `/listing/${picked.id}?tab=carriers`
                    : `/listing/${picked.id}`
                }
              >
                {picked.own ? t("chips.findCarriers") : t("chips.openListing")}
              </Link>
            </Button>
          </CenteredEmptyState>
        ) : (
          <CenteredEmptyState
            variant="page"
            icon={MessageSquare}
            title={t("empty.title")}
            description={t("empty.description")}
          />
        )}
      </div>
    </div>
  );
}
