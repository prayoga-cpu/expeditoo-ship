"use client";

import Link from "next/link";
import { ArrowLeft, MessagesSquare, Paperclip } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useUserThread } from "../../hooks/useUserActivity";
import type { ActivityMessageView } from "../../api/user-activity.api";
import { activityHref, useConversationTitle } from "./ActivitySections";
import { JobLine, OpenJobButton, useActivityDate, useOfferStatusLabel } from "./parts";

function MessageLine({ message, own }: { message: ActivityMessageView; own: boolean }) {
  const t = useTranslations("admin.userActivity.thread");
  const date = useActivityDate();
  const status = useOfferStatusLabel();

  return (
    <li
      data-testid="activity-message"
      className={cn(
        "rounded-lg border p-3",
        own ? "border-primary/30 bg-primary/5" : "bg-card"
      )}
    >
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">
          {message.senderName ?? t("deletedSender")}
        </span>
        <time dateTime={message.createdAt}>{date(message.createdAt, true)}</time>
      </p>
      {message.offer ? (
        <p className="mt-1.5 text-sm font-medium text-foreground">
          {t("offerLine", {
            price: formatCurrency(message.offer.priceCents),
            status: status(message.offer.status),
          })}
        </p>
      ) : (
        <p className="mt-1.5 text-sm whitespace-pre-wrap break-words text-foreground">
          {message.content}
        </p>
      )}
      {message.hasAttachment && (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" aria-hidden />
          {t("attachment")}
        </p>
      )}
    </li>
  );
}

function BackToConversations({ userId }: { userId: string }) {
  const t = useTranslations("admin.userActivity.thread");
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 gap-2">
      <Link href={activityHref(userId, "?tab=conversations")}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("back")}
      </Link>
    </Button>
  );
}

/** The messages oldest first, with the way to older ones above them. */
function ThreadMessages({
  userId,
  messages,
  older,
}: {
  userId: string;
  messages: ActivityMessageView[];
  older: { load: () => void; loading: boolean } | null;
}) {
  const t = useTranslations("admin.userActivity.thread");

  if (messages.length === 0) {
    return (
      <CenteredEmptyState
        icon={MessagesSquare}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      >
        <Button asChild variant="outline" className="mt-4">
          <Link href={activityHref(userId, "?tab=conversations")}>{t("back")}</Link>
        </Button>
      </CenteredEmptyState>
    );
  }

  return (
    <>
      {older && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={older.load}
            disabled={older.loading}
          >
            {older.loading && <LottieLoader width={20} height={20} />}
            {t("loadOlder")}
          </Button>
        </div>
      )}
      <ul className="space-y-2">
        {messages.map((message) => (
          <MessageLine key={message.id} message={message} own={message.senderId === userId} />
        ))}
      </ul>
    </>
  );
}

/**
 * One conversation, read by staff. No composer, no accept, no mark-as-read:
 * the reader is not a participant, and nothing here writes
 * (admin_user_management_spec.md §7.3).
 */
export function ConversationThread({
  userId,
  conversationId,
}: {
  userId: string;
  conversationId: string;
}) {
  const t = useTranslations("admin.userActivity.thread");
  const title = useConversationTitle();
  const query = useUserThread(userId, conversationId);

  if (query.isLoading) {
    return (
      <div className="space-y-3" data-testid="activity-thread-loading">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <LoadErrorState
        onRetry={() => query.refetch()}
        back={{ href: activityHref(userId, "?tab=conversations"), label: t("back") }}
      />
    );
  }

  const { conversation } = query.data.pages[0];
  // Pages arrive newest first; a thread reads oldest first.
  const messages = query.data.pages.flatMap((page) => page.messages.items).reverse();

  return (
    <section className="space-y-4" data-testid="activity-thread">
      <BackToConversations userId={userId} />
      <header className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="font-semibold text-foreground break-words">{title(conversation)}</h2>
          {conversation.job && <JobLine job={conversation.job} />}
        </div>
        {conversation.job && <OpenJobButton jobId={conversation.job.id} />}
      </header>

      <ThreadMessages
        userId={userId}
        messages={messages}
        older={
          query.hasNextPage
            ? { load: () => query.fetchNextPage(), loading: query.isFetchingNextPage }
            : null
        }
      />
    </section>
  );
}
