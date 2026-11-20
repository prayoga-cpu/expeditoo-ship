"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { PageLoader } from "@/components/ui/page-loader";
import {
  UserActivityView,
  isActivityTab,
} from "@/features/app/admin/ui/user-activity";

/**
 * /admin/users/:id/activity — « Demandes et messages » for one account
 * (admin_user_management_spec.md §7). A route rather than an in-page swap, so
 * the row menu of both tables reaches it, a job page or a thread opened from
 * it comes back to it, and the address can be passed to a colleague.
 */
export default function UserActivityPage() {
  // useSearchParams suspends during prerender, and this page is a client
  // component with no other boundary of its own.
  return (
    <Suspense fallback={<PageLoader />}>
      <UserActivityPageContent />
    </Suspense>
  );
}

function UserActivityPageContent() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const tab = search.get("tab");

  // Opened from a link with no history behind it (a pasted address): Back
  // still leads somewhere.
  const back = () =>
    window.history.length > 1 ? router.back() : router.push("/admin/users");

  return (
    <UserActivityView
      userId={id}
      tab={isActivityTab(tab) ? tab : "requests"}
      conversationId={search.get("conversation")}
      onBack={back}
    />
  );
}
