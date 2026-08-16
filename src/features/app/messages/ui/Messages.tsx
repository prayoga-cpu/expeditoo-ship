"use client";

import { Search, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";

import { MessageRow } from "./MessageRow";
import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import type { Message } from "../types";
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
}

export function Messages({
  messages,
  searchQuery,
  onSearchChange,
  onDeleteConversation,
  isLoading = false,
  basePath = "/messages",
}: MessagesProps) {
  const t = useTranslations("messages");

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
