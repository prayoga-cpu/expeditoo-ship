import { adminUserActivityDal } from "@/server/dal/admin-user-activity.dal";
import { AdminError } from "@/server/services/admin.service";
import { hasAnyRole } from "@/server/services/user.service";
import {
  ACTIVITY_PAGE_SIZE,
  activityPageQuerySchema,
  toConversationView,
  toMessageView,
  toOfferView,
  toPage,
  toRequestView,
  type ActivityConversationRow,
  type ActivityPage,
  type ActivityConversationView,
  type ActivityOfferView,
  type ActivityRequestView,
  type ActivitySummaryView,
  type ActivityThreadView,
} from "@/server/dto/admin-user-activity.dto";

// ========================================
// A user's requests, offers and conversations, read by staff
// docs/specs/admin_user_management_spec.md §7
// ========================================
//
// Read-only by construction: this service imports one DAL, and that DAL only
// selects. It must not grow a call into `messagesService` / `messagesDal` —
// those mark a thread read for whoever opens it, and staff looking at a
// conversation is not one of its participants (the same rule §3.5 sets for a
// borrowed session).

/**
 * Who may read another account's requests, offers and private messages.
 *
 * `admin`, and `support` — the desk roles_spec.md §2 gives « read users … act
 * in support conversations ». Not `operator` (dispatch: jobs, not people's
 * correspondence) and not `finance` (money, no user moderation).
 */
export const ACTIVITY_READER_ROLES = ["admin", "support"] as const;

type ConversationBase = Omit<ActivityConversationRow, "others" | "messageCount">;

async function assertReader(viewerId: string) {
  if (!(await hasAnyRole(viewerId, [...ACTIVITY_READER_ROLES]))) {
    throw new AdminError("FORBIDDEN_ROLE", "Not allowed to read this account's activity", 403);
  }
}

/** The permission first, so a stranger cannot probe which ids exist. */
async function authorise(viewerId: string, userId: string) {
  await assertReader(viewerId);
  const target = await adminUserActivityDal.getUser(userId);
  if (!target) throw new AdminError("USER_NOT_FOUND", "User not found", 404);
  return target;
}

function paging(query: unknown) {
  const { page } = activityPageQuerySchema.parse(query ?? {});
  return { page, limit: ACTIVITY_PAGE_SIZE, offset: (page - 1) * ACTIVITY_PAGE_SIZE };
}

/** Adds the other parties and the message count to each conversation. */
async function decorate(userId: string, rows: ConversationBase[]) {
  const ids = rows.map((row) => row.id);
  const [parties, counts] = await Promise.all([
    adminUserActivityDal.otherParties(userId, ids),
    adminUserActivityDal.messageCounts(ids),
  ]);
  const countOf = new Map(counts.map((row) => [row.conversationId, row.value]));

  return rows.map((row) =>
    toConversationView({
      ...row,
      others: parties.filter((party) => party.conversationId === row.id),
      messageCount: countOf.get(row.id) ?? 0,
    })
  );
}

export const adminUserActivityService = {
  /** Who this is, and how much there is to read. */
  async summary(viewerId: string, userId: string): Promise<ActivitySummaryView> {
    const target = await authorise(viewerId, userId);
    const [requests, offers, conversations] = await Promise.all([
      adminUserActivityDal.countRequests(userId),
      adminUserActivityDal.countOffers(userId),
      adminUserActivityDal.countConversations(userId),
    ]);
    return {
      user: { id: target.id, name: target.name, email: target.email },
      counts: { requests, offers, conversations },
    };
  },

  /** The requests this account posted, drafts included, newest first. */
  async requests(
    viewerId: string,
    userId: string,
    query?: unknown
  ): Promise<ActivityPage<ActivityRequestView>> {
    await authorise(viewerId, userId);
    const { page, limit, offset } = paging(query);
    const [rows, total] = await Promise.all([
      adminUserActivityDal.listRequests(userId, { limit, offset }),
      adminUserActivityDal.countRequests(userId),
    ]);
    return toPage(rows.map(toRequestView), page, total);
  },

  /** The offers this account made as a transporter, newest first. */
  async offers(
    viewerId: string,
    userId: string,
    query?: unknown
  ): Promise<ActivityPage<ActivityOfferView>> {
    await authorise(viewerId, userId);
    const { page, limit, offset } = paging(query);
    const [rows, total] = await Promise.all([
      adminUserActivityDal.listOffers(userId, { limit, offset }),
      adminUserActivityDal.countOffers(userId),
    ]);
    return toPage(rows.map(toOfferView), page, total);
  },

  /** The conversations this account is in, most recently active first. */
  async conversations(
    viewerId: string,
    userId: string,
    query?: unknown
  ): Promise<ActivityPage<ActivityConversationView>> {
    await authorise(viewerId, userId);
    const { page, limit, offset } = paging(query);
    const [rows, total] = await Promise.all([
      adminUserActivityDal.listConversations(userId, { limit, offset }),
      adminUserActivityDal.countConversations(userId),
    ]);
    return toPage(await decorate(userId, rows), page, total);
  },

  /**
   * One conversation's messages, newest first. A conversation this account is
   * not in answers 404, never 403: the endpoint reads a user's threads, it is
   * not a way to open any thread by id.
   */
  async thread(
    viewerId: string,
    userId: string,
    conversationId: string,
    query?: unknown
  ): Promise<ActivityThreadView> {
    await authorise(viewerId, userId);
    const { page, limit, offset } = paging(query);
    const row = await adminUserActivityDal.getConversationOf(userId, conversationId);
    if (!row) throw new AdminError("CONVERSATION_NOT_FOUND", "Conversation not found", 404);

    const [[conversation], rows, total] = await Promise.all([
      decorate(userId, [row]),
      adminUserActivityDal.listMessages(conversationId, { limit, offset }),
      adminUserActivityDal.countMessages(conversationId),
    ]);
    return { conversation, messages: toPage(rows.map(toMessageView), page, total) };
  },
};
