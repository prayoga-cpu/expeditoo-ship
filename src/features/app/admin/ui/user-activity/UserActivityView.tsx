"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, UserX } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { LoadErrorState } from "@/components/ui/load-error-state";
import { PageLoader } from "@/components/ui/page-loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isRefusal } from "@/lib/fetcher";
import { useUserActivitySummary } from "../../hooks/useUserActivity";
import type { ActivitySummaryView } from "../../api/user-activity.api";
import {
  ConversationsSection,
  OffersSection,
  RequestsSection,
  activityHref,
} from "./ActivitySections";
import { ConversationThread } from "./ConversationThread";

export const ACTIVITY_TABS = ["requests", "offers", "conversations"] as const;
export type ActivityTab = (typeof ACTIVITY_TABS)[number];

export const isActivityTab = (value: string | null): value is ActivityTab =>
  (ACTIVITY_TABS as readonly string[]).includes(value ?? "");

interface UserActivityViewProps {
  userId: string;
  tab: ActivityTab;
  /** Set when one conversation is open; the tabs give way to its messages. */
  conversationId: string | null;
  onBack: () => void;
}

function Header({ summary, onBack }: { summary: ActivitySummaryView; onBack: () => void }) {
  const t = useTranslations("admin.userActivity");
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2 gap-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("back")}
      </Button>
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{t("title")}</h1>
        <p className="break-words text-muted-foreground">
          {summary.user.name} · {summary.user.email}
        </p>
      </div>
      <p className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
        <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {t("readOnly")}
      </p>
    </div>
  );
}

function ActivityTabs({
  userId,
  tab,
  counts,
}: {
  userId: string;
  tab: ActivityTab;
  counts: ActivitySummaryView["counts"];
}) {
  const t = useTranslations("admin.userActivity.tabs");
  const router = useRouter();
  // The tab lives in the URL, so Back from a conversation or a job page
  // returns to the list the admin was reading.
  const select = (next: string) =>
    router.replace(activityHref(userId, `?tab=${next}`), { scroll: false });

  return (
    <Tabs value={tab} onValueChange={select} className="space-y-4">
      <div className="overflow-x-auto">
        <TabsList>
          {ACTIVITY_TABS.map((name) => (
            <TabsTrigger key={name} value={name}>
              {t(name, { count: counts[name] })}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value="requests">
        <RequestsSection userId={userId} />
      </TabsContent>
      <TabsContent value="offers">
        <OffersSection userId={userId} />
      </TabsContent>
      <TabsContent value="conversations">
        <ConversationsSection userId={userId} />
      </TabsContent>
    </Tabs>
  );
}

/**
 * « Demandes et messages » — what one account posted, what it offered as a
 * transporter, and its conversations, for staff, read-only
 * (admin_user_management_spec.md §7).
 */
export function UserActivityView({ userId, tab, conversationId, onBack }: UserActivityViewProps) {
  const t = useTranslations("admin.userActivity");
  const summary = useUserActivitySummary(userId);

  if (summary.isLoading) return <PageLoader />;

  // Not allowed, or no such account: trying again will not change the answer.
  if (summary.isError && isRefusal(summary.error)) {
    return (
      <CenteredEmptyState
        variant="page"
        icon={UserX}
        title={t("unavailable.title")}
        description={t("unavailable.description")}
      >
        <Button asChild variant="outline" className="mt-4">
          <Link href="/admin/users">{t("backToUsers")}</Link>
        </Button>
      </CenteredEmptyState>
    );
  }

  if (summary.isError || !summary.data) {
    return (
      <LoadErrorState
        variant="page"
        onRetry={() => summary.refetch()}
        back={{ href: "/admin/users", label: t("backToUsers") }}
      />
    );
  }

  return (
    <div className="w-full space-y-6 pb-24">
      <Header summary={summary.data} onBack={onBack} />
      {conversationId ? (
        <ConversationThread userId={userId} conversationId={conversationId} />
      ) : (
        <ActivityTabs userId={userId} tab={tab} counts={summary.data.counts} />
      )}
    </div>
  );
}
