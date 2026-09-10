import { nanoid } from "nanoid";

import * as feedbackDal from "@/server/dal/feedback.dal";
import { getUserById, getUsersByRole } from "@/server/dal/users.dal";
import { notificationsService } from "@/server/services/notifications.service";
import { primaryRole } from "@/lib/primary-role";
import { APP_VERSION } from "@/lib/version";
import {
  feedbackStatusEnum,
  type FeedbackStatusValue,
  type FeedbackTicket,
} from "@/db/schema/feedback";
import {
  toAdminFeedbackView,
  toFeedbackView,
  type AdminFeedbackView,
  type FeedbackQuery,
  type FeedbackView,
  type SubmitFeedbackInput,
  type TriageFeedbackInput,
} from "@/server/dto/feedback.dto";
import type { Viewer } from "@/server/services/shipment-access";

export class FeedbackError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "FeedbackError";
  }
}

const err = (code: string, status: number, message?: string) =>
  new FeedbackError(code, status, message);

/**
 * Back-office staff, matching `shipmentIncidentsService` so there is one
 * definition of the phrase.
 *
 * Stated plainly because it has a consequence: `src/proxy.ts` gates `/admin` on
 * the `admin` role alone, so an operator may call this API but cannot open
 * `/admin/feedback` in a browser. That is pre-existing across every admin
 * queue, not something this feature invents.
 */
const isStaff = (viewer: Viewer) =>
  Boolean(viewer.isAdmin || viewer.isOperator);

/** A notification line has to fit on a phone. */
function summarise(description: string, max = 140): string {
  const flat = description.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

export const feedbackService = {
  /**
   * Anyone signed in may write to us. No role gate — that is the requirement.
   *
   * Identity, role, build and status are stamped here, never taken from the
   * client, which is what stops someone filing as another person or opening
   * their own ticket at `urgent`.
   */
  async submit(
    input: SubmitFeedbackInput,
    viewer: Viewer
  ): Promise<FeedbackView> {
    const account = await getUserById(viewer.userId);
    if (!account) throw err("UNAUTHENTICATED", 401);

    const ticket = await feedbackDal.create({
      id: nanoid(),
      userId: viewer.userId,
      userName: account.name ?? "",
      userEmail: account.email ?? "",
      userRole: primaryRole((account.roles ?? []).map((r) => r.role)),
      type: input.type,
      surface: input.surface,
      pathname: input.pathname ?? null,
      description: input.description,
      screenshotUrls: input.screenshotUrls,
      appVersion: APP_VERSION,
      locale: input.locale,
      // `status` and `priority` are left to the column defaults on purpose.
    });

    await this.announce(ticket);

    return toFeedbackView(ticket);
  },

  /**
   * Tell the people who triage.
   *
   * In its own try, and that containment is the point: a notification failure
   * may never lose the report. Same discipline as `invoicesService.createFromPayment`
   * firing from `settleDelivery` so paperwork cannot strand a captured payment.
   */
  async announce(ticket: FeedbackTicket): Promise<void> {
    try {
      const [operators, admins] = await Promise.all([
        getUsersByRole("operator"),
        getUsersByRole("admin"),
      ]);

      // An admin who is also an operator is one person with one inbox.
      const recipients = new Set(
        [...operators, ...admins].filter(Boolean).map((row) => row.id)
      );

      await Promise.all(
        [...recipients].map((userId) =>
          notificationsService.createNotification({
            userId,
            type: "feedback_submitted",
            title: "New feedback",
            message: summarise(ticket.description),
            linkUrl: "/admin/feedback",
            data: {
              feedbackId: ticket.id,
              type: ticket.type,
              surface: ticket.surface,
            },
          })
        )
      );
    } catch (error) {
      console.error("[feedback] announce failed", error);
    }
  },

  /** Scoping by the viewer's own id *is* the authorisation here. */
  async listMine(viewer: Viewer): Promise<FeedbackView[]> {
    const rows = await feedbackDal.listForUser(viewer.userId, 50);
    return rows.map(toFeedbackView);
  },

  /**
   * The console. Counts travel with the page so the tiles can never disagree
   * with the list they sit above.
   */
  async listQueue(
    query: FeedbackQuery,
    viewer: Viewer
  ): Promise<{
    items: AdminFeedbackView[];
    meta: {
      total: number;
      limit: number;
      offset: number;
      counts: Record<FeedbackStatusValue, number>;
    };
  }> {
    if (!isStaff(viewer)) throw err("FORBIDDEN", 403);

    const [{ items, total }, rawCounts] = await Promise.all([
      feedbackDal.listQueue(query),
      feedbackDal.countsByStatus(query),
    ]);

    // Zero-filled, so a status the query returned no rows for still renders a
    // tile reading 0 rather than disappearing.
    const counts = Object.fromEntries(
      feedbackStatusEnum.enumValues.map((s) => [s, rawCounts[s] ?? 0])
    ) as Record<FeedbackStatusValue, number>;

    return {
      items: items.map((r) => toAdminFeedbackView(r.ticket, r.account)),
      meta: { total, limit: query.limit, offset: query.offset, counts },
    };
  },

  /**
   * Move a ticket. Any status may follow any status — a triage board is not a
   * state machine, and refusing ARCHIVED → OPEN would strand tickets.
   */
  async triage(
    id: string,
    input: TriageFeedbackInput,
    viewer: Viewer
  ): Promise<AdminFeedbackView> {
    if (!isStaff(viewer)) throw err("FORBIDDEN", 403);

    const ticket = await feedbackDal.getById(id);
    if (!ticket) throw err("FEEDBACK_NOT_FOUND", 404);

    const patch: Parameters<typeof feedbackDal.update>[1] = { ...input };

    // Only on the transition INTO resolved, so re-saving a note on a resolved
    // ticket does not rewrite who closed it or when.
    if (input.status === "RESOLVED" && ticket.status !== "RESOLVED") {
      patch.resolvedAt = new Date();
      patch.resolvedByUserId = viewer.userId;
    }
    if (
      input.status &&
      input.status !== "RESOLVED" &&
      ticket.status === "RESOLVED"
    ) {
      patch.resolvedAt = null;
      patch.resolvedByUserId = null;
    }

    const updated = await feedbackDal.update(id, patch);
    if (!updated) throw err("FEEDBACK_NOT_FOUND", 404);

    const account = updated.userId ? await getUserById(updated.userId) : null;
    return toAdminFeedbackView(
      updated,
      account
        ? {
            id: account.id,
            name: account.name ?? updated.userName,
            email: account.email ?? updated.userEmail,
          }
        : null
    );
  },
};
