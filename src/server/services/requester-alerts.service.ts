import { carriersDal } from "@/server/dal/carriers.dal";
import { messagesDAL } from "@/server/dal/messages.dal";
import { getUserById } from "@/server/dal/users.dal";
import { emailService } from "@/server/services/email.service";
import { MESSAGE_ALERT_QUIET_MS } from "@/server/services/driver-alerts.service";

/**
 * The requester hears when a driver writes to them
 * (docs/specs/requester_message_alert_spec.md) — the mirror of the driver's
 * alert in `driver-alerts.service.ts`, which only ever fired the other way.
 *
 * Email only: the requester's phone sits in `user_contact_details`, read by the
 * owner and staff, and a text per message is a flood. The email names the job
 * and links to the conversation, never the driver's words. Best-effort — it
 * never fails the message that triggered it.
 */

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://expeditoo.com";

export interface RequesterAlertResult {
  email: boolean;
  skippedReason?: string;
}

const skipped = (skippedReason: string): RequesterAlertResult => ({ email: false, skippedReason });

export const requesterAlertsService = {
  /**
   * A message was sent in `conversationId`. Alerts only when it is a driver
   * writing to the person who posted that job: not the requester writing, not a
   * support thread, not a thread with no job, and not an escalated job, whose
   * owner is the system account nobody reads.
   */
  async onDriverMessage(params: {
    conversationId: string;
    senderId: string;
    recipientId: string | null;
    sentAt: Date;
  }): Promise<RequesterAlertResult> {
    if (!params.recipientId) return skipped("NO_RECIPIENT");
    const conversation = await messagesDAL.getConversationById(params.conversationId);
    const listing = conversation?.listing;
    if (!listing) return skipped("NO_JOB");
    if (listing.origin !== "direct") return skipped("NOT_A_DIRECT_REQUEST");
    if (listing.shipperId === params.senderId) return skipped("FROM_REQUESTER");
    if (listing.shipperId !== params.recipientId) return skipped("NOT_TO_REQUESTER");

    const carrier = await carriersDal.getByUserId(params.senderId);
    if (!carrier) return skipped("NOT_A_DRIVER");

    const last = await messagesDAL.lastMessageAtBefore(
      params.conversationId,
      params.senderId,
      params.sentAt
    );
    if (last && params.sentAt.getTime() - last.getTime() < MESSAGE_ALERT_QUIET_MS) {
      return skipped("RECENTLY_ALERTED");
    }

    const requester = await getUserById(listing.shipperId);
    if (!requester?.email) return skipped("NO_EMAIL");

    await emailService.sendRequesterMessageEmail(requester.email, {
      recipientName: requester.name,
      jobTitle: listing.title,
      url: `${appUrl()}/messages/${params.conversationId}`,
    });
    return { email: true };
  },
};
