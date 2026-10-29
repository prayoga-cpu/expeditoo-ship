import { carriersDal } from "@/server/dal/carriers.dal";
import { messagesDAL } from "@/server/dal/messages.dal";
import { expedionSmsService, type SmsResult } from "@/server/services/expedion-sms.service";

/**
 * Texts to the driver (client_feedback_2026_10_29_spec.md §N7): when the
 * requester writes to them, and when their offer is accepted. The same Twilio
 * sender as the Expedion bridge — and, like it, best-effort: a text that fails
 * never fails the message or the award. Until Twilio is configured
 * (`TWILIO_*`, STATUS → Operator to-do) every send answers
 * `TWILIO_NOT_CONFIGURED` and nothing leaves.
 *
 * The text never carries the message itself: an SMS sits on a lock screen, and
 * what the requester wrote is for the app. It names the job and links to it.
 */

/** A burst of messages is one text: none within this long of the last. */
export const MESSAGE_SMS_QUIET_MS = 30 * 60 * 1000;

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://expeditoo.com";

async function driverPhone(userId: string): Promise<string | null> {
  const carrier = await carriersDal.getByUserId(userId);
  return carrier?.contactPhone ?? null;
}

const skipped = (skippedReason: string): SmsResult => ({ sent: false, skippedReason });

export const driverSmsService = {
  /**
   * The requester of a job wrote to a driver about it. Only that pair: a
   * driver writing to the requester, or a support thread, sends nothing.
   */
  async onNewMessage(params: {
    conversationId: string;
    senderId: string;
    recipientId: string | null;
    sentAt: Date;
  }): Promise<SmsResult> {
    if (!params.recipientId) return skipped("NO_RECIPIENT");
    const conversation = await messagesDAL.getConversationById(params.conversationId);
    const listing = conversation?.listing;
    if (!listing || listing.shipperId !== params.senderId) return skipped("NOT_FROM_REQUESTER");

    const phone = await driverPhone(params.recipientId);
    if (!phone) return skipped("NOT_A_DRIVER");

    const last = await messagesDAL.lastMessageAtBefore(
      params.conversationId,
      params.senderId,
      params.sentAt
    );
    if (last && params.sentAt.getTime() - last.getTime() < MESSAGE_SMS_QUIET_MS) {
      return skipped("RECENTLY_TEXTED");
    }

    return await expedionSmsService.send(
      phone,
      `Expeditoo : nouveau message de votre client au sujet de « ${listing.title} ». ` +
        `Répondez ici : ${appUrl()}/messages/${params.conversationId}`
    );
  },

  /** The requester (or an operator) accepted this driver's offer. */
  async onOfferAccepted(params: {
    carrierUserId: string;
    jobTitle: string;
    listingId: string;
  }): Promise<SmsResult> {
    const phone = await driverPhone(params.carrierUserId);
    if (!phone) return skipped("NOT_A_DRIVER");
    return await expedionSmsService.send(
      phone,
      `Expeditoo : votre offre pour « ${params.jobTitle} » a été acceptée. ` +
        `Détails : ${appUrl()}/listing/${params.listingId}`
    );
  },
};
