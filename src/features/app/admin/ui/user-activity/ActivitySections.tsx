"use client";

import Link from "next/link";
import { FileText, HandCoins, MessagesSquare } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import {
  useUserConversations,
  useUserOffers,
  useUserRequests,
} from "../../hooks/useUserActivity";
import type {
  ActivityConversationView,
  ActivityOfferView,
  ActivityRequestView,
} from "../../api/user-activity.api";
import { PagedList } from "./PagedList";
import {
  ActivityRow,
  JobLine,
  ListingStatusBadge,
  OfferStatusBadge,
  OpenJobButton,
  useActivityDate,
} from "./parts";

export const activityHref = (userId: string, query = "") =>
  `/admin/users/${userId}/activity${query}`;

const USERS_HREF = "/admin/users";

function RequestRow({ request }: { request: ActivityRequestView }) {
  const t = useTranslations("admin.userActivity");
  const date = useActivityDate();
  return (
    <ActivityRow action={<OpenJobButton jobId={request.id} />}>
      <JobLine job={request} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <ListingStatusBadge status={request.status} expiresAt={request.expiresAt} />
        <span>{t("pickupOn", { date: date(request.pickupFrom) })}</span>
        <span>{t("offersCount", { count: request.offersCount })}</span>
      </div>
    </ActivityRow>
  );
}

/** (1) The requests this account posted. */
export function RequestsSection({ userId }: { userId: string }) {
  const t = useTranslations("admin.userActivity.requests");
  return (
    <PagedList
      query={useUserRequests(userId)}
      itemsOf={(page) => page.items}
      renderItem={(request) => <RequestRow key={request.id} request={request} />}
      empty={{ icon: FileText, title: t("emptyTitle"), description: t("emptyDescription") }}
      emptyHref={USERS_HREF}
      testId="activity-requests"
    />
  );
}

function OfferRow({ offer }: { offer: ActivityOfferView }) {
  const t = useTranslations("admin.userActivity");
  const date = useActivityDate();
  return (
    <ActivityRow action={<OpenJobButton jobId={offer.job.id} />}>
      <JobLine job={offer.job} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="font-mono font-semibold tabular-nums text-foreground">
          {formatCurrency(offer.priceCents)}
        </span>
        <OfferStatusBadge status={offer.status} />
        <span>{t("offeredOn", { date: date(offer.createdAt) })}</span>
      </div>
    </ActivityRow>
  );
}

/** (2) The offers this account made as a transporter. */
export function OffersSection({ userId }: { userId: string }) {
  const t = useTranslations("admin.userActivity.offers");
  return (
    <PagedList
      query={useUserOffers(userId)}
      itemsOf={(page) => page.items}
      renderItem={(offer) => <OfferRow key={offer.id} offer={offer} />}
      empty={{ icon: HandCoins, title: t("emptyTitle"), description: t("emptyDescription") }}
      emptyHref={USERS_HREF}
      testId="activity-offers"
    />
  );
}

/** « Avec Jean Transport », « Support », or a party whose account is gone. */
export function useConversationTitle() {
  const t = useTranslations("admin.userActivity.conversations");
  return (conversation: ActivityConversationView) => {
    if (conversation.others.length > 0) {
      return t("with", { names: conversation.others.map((party) => party.name).join(", ") });
    }
    return conversation.type === "SUPPORT" ? t("support") : t("unknownParty");
  };
}

function ConversationRow({
  userId,
  conversation,
}: {
  userId: string;
  conversation: ActivityConversationView;
}) {
  const t = useTranslations("admin.userActivity.conversations");
  const date = useActivityDate();
  const title = useConversationTitle();
  const read = (
    <Button asChild variant="outline" size="sm">
      <Link href={activityHref(userId, `?conversation=${conversation.id}`)}>{t("read")}</Link>
    </Button>
  );

  return (
    <ActivityRow action={read}>
      <p className="font-medium text-foreground break-words">{title(conversation)}</p>
      {conversation.job ? (
        <JobLine job={conversation.job} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("noJob")}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{t("messageCount", { count: conversation.messageCount })}</span>
        <span>
          {conversation.lastMessageAt
            ? t("lastMessage", { date: date(conversation.lastMessageAt, true) })
            : t("noMessage")}
        </span>
      </div>
    </ActivityRow>
  );
}

/** (3) The conversations this account is in. */
export function ConversationsSection({ userId }: { userId: string }) {
  const t = useTranslations("admin.userActivity.conversations");
  return (
    <PagedList
      query={useUserConversations(userId)}
      itemsOf={(page) => page.items}
      renderItem={(conversation) => (
        <ConversationRow key={conversation.id} userId={userId} conversation={conversation} />
      )}
      empty={{ icon: MessagesSquare, title: t("emptyTitle"), description: t("emptyDescription") }}
      emptyHref={USERS_HREF}
      testId="activity-conversations"
    />
  );
}
