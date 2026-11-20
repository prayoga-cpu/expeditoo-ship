import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { isRefusal } from "@/lib/fetcher";
import { userActivityApi, type ActivityPage } from "../api/user-activity.api";

/**
 * Reads behind « Demandes et messages » (admin_user_management_spec.md §7).
 * Queries only — this surface has no mutation, and must not gain one.
 */

const key = (userId: string, ...rest: string[]) =>
  ["admin", "users", userId, "activity", ...rest] as const;

/** A 403 or a 404 will not change on a second try. */
const retry = (count: number, error: unknown) => !isRefusal(error) && count < 2;

const nextPage = <T,>(last: ActivityPage<T>) => (last.hasMore ? last.page + 1 : undefined);

export function useUserActivitySummary(userId: string) {
  return useQuery({
    queryKey: key(userId, "summary"),
    queryFn: () => userActivityApi.summary(userId),
    retry,
  });
}

export function useUserRequests(userId: string) {
  return useInfiniteQuery({
    queryKey: key(userId, "requests"),
    queryFn: ({ pageParam }) => userActivityApi.requests(userId, pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    retry,
  });
}

export function useUserOffers(userId: string) {
  return useInfiniteQuery({
    queryKey: key(userId, "offers"),
    queryFn: ({ pageParam }) => userActivityApi.offers(userId, pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    retry,
  });
}

export function useUserConversations(userId: string) {
  return useInfiniteQuery({
    queryKey: key(userId, "conversations"),
    queryFn: ({ pageParam }) => userActivityApi.conversations(userId, pageParam),
    initialPageParam: 1,
    getNextPageParam: nextPage,
    retry,
  });
}

/** Pages run newest first; the view turns them round to read as a thread. */
export function useUserThread(userId: string, conversationId: string) {
  return useInfiniteQuery({
    queryKey: key(userId, "thread", conversationId),
    queryFn: ({ pageParam }) => userActivityApi.thread(userId, conversationId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => nextPage(last.messages),
    retry,
  });
}
