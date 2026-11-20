import { api } from "@/lib/fetcher";
import type {
  ActivityConversationView,
  ActivityJobView,
  ActivityMessageView,
  ActivityOfferView,
  ActivityPage,
  ActivityRequestView,
  ActivitySummaryView,
  ActivityThreadView,
} from "@/server/dto/admin-user-activity.dto";

/**
 * Client API for « Demandes et messages » — one account's requests, offers
 * and conversations, read by staff (admin_user_management_spec.md §7).
 * Every call is a GET: there is nothing here to write.
 */

export type {
  ActivityConversationView,
  ActivityJobView,
  ActivityMessageView,
  ActivityOfferView,
  ActivityPage,
  ActivityRequestView,
  ActivitySummaryView,
  ActivityThreadView,
};

const base = (userId: string) => `/api/admin/users/${encodeURIComponent(userId)}`;

export const userActivityApi = {
  summary: (userId: string) => api.get<ActivitySummaryView>(`${base(userId)}/activity`),

  requests: (userId: string, page: number) =>
    api.get<ActivityPage<ActivityRequestView>>(`${base(userId)}/requests?page=${page}`),

  offers: (userId: string, page: number) =>
    api.get<ActivityPage<ActivityOfferView>>(`${base(userId)}/offers?page=${page}`),

  conversations: (userId: string, page: number) =>
    api.get<ActivityPage<ActivityConversationView>>(
      `${base(userId)}/conversations?page=${page}`
    ),

  thread: (userId: string, conversationId: string, page: number) =>
    api.get<ActivityThreadView>(
      `${base(userId)}/conversations/${encodeURIComponent(conversationId)}?page=${page}`
    ),
};
