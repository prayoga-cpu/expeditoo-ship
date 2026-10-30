import { carriersDal } from "@/server/dal/carriers.dal";
import { messagesDAL } from "@/server/dal/messages.dal";
import { getUserById } from "@/server/dal/users.dal";
import { emailService } from "@/server/services/email.service";
import { expedionSmsService } from "@/server/services/expedion-sms.service";
import type { DriverAlertEmailProps } from "@/server/emails/DriverAlertEmail";

/**
 * Alerts to the driver (client_feedback_2026_10_29_spec.md §N7): when the
 * requester writes to them, and when their offer is accepted — by **email and
 * text**. Decided on 30 October: email now, texts the day the `TWILIO_*`
 * variables exist; until then every text answers `TWILIO_NOT_CONFIGURED` and
 * only the email leaves. The same Twilio sender as the Expedion bridge.
 *
 * Best-effort throughout: an alert that fails never fails the message or the
 * award. Neither channel carries the client's words — an SMS sits on a lock
 * screen, an email in an inbox; what the requester wrote is for the app.
 */

/** A burst of messages is one alert: none within this long of the last. */
export const MESSAGE_ALERT_QUIET_MS = 30 * 60 * 1000;

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://expeditoo.com";

export interface AlertResult {
  sms: boolean;
  email: boolean;
  skippedReason?: string;
}

const skipped = (skippedReason: string): AlertResult => ({ sms: false, email: false, skippedReason });

/** Text and email the driver; each channel on its own, neither can sink the other. */
async function alert(
  driverUserId: string,
  phone: string,
  sms: string,
  email: Omit<DriverAlertEmailProps, "recipientName">
): Promise<AlertResult> {
  const [text, mail] = await Promise.allSettled([
    expedionSmsService.send(phone, sms),
    (async () => {
      const driver = await getUserById(driverUserId);
      if (!driver?.email) return false;
      await emailService.sendDriverAlertEmail(driver.email, { ...email, recipientName: driver.name });
      return true;
    })(),
  ]);
  return {
    sms: text.status === "fulfilled" && text.value.sent,
    email: mail.status === "fulfilled" && mail.value,
  };
}

export const driverAlertsService = {
  /**
   * The requester of a job wrote to a driver about it. Only that pair: a
   * driver writing to the requester, or a support thread, alerts nobody.
   */
  async onNewMessage(params: {
    conversationId: string;
    senderId: string;
    recipientId: string | null;
    sentAt: Date;
  }): Promise<AlertResult> {
    if (!params.recipientId) return skipped("NO_RECIPIENT");
    const conversation = await messagesDAL.getConversationById(params.conversationId);
    const listing = conversation?.listing;
    if (!listing || listing.shipperId !== params.senderId) return skipped("NOT_FROM_REQUESTER");

    const carrier = await carriersDal.getByUserId(params.recipientId);
    if (!carrier) return skipped("NOT_A_DRIVER");

    const last = await messagesDAL.lastMessageAtBefore(
      params.conversationId,
      params.senderId,
      params.sentAt
    );
    if (last && params.sentAt.getTime() - last.getTime() < MESSAGE_ALERT_QUIET_MS) {
      return skipped("RECENTLY_ALERTED");
    }

    const url = `${appUrl()}/messages/${params.conversationId}`;
    return await alert(
      params.recipientId,
      carrier.contactPhone,
      `Expeditoo : nouveau message de votre client au sujet de « ${listing.title} ». Répondez ici : ${url}`,
      { kind: "message", jobTitle: listing.title, url }
    );
  },

  /** The requester (or an operator) accepted this driver's offer. */
  async onOfferAccepted(params: {
    carrierUserId: string;
    jobTitle: string;
    listingId: string;
  }): Promise<AlertResult> {
    const carrier = await carriersDal.getByUserId(params.carrierUserId);
    if (!carrier) return skipped("NOT_A_DRIVER");
    const url = `${appUrl()}/listing/${params.listingId}`;
    return await alert(
      params.carrierUserId,
      carrier.contactPhone,
      `Expeditoo : votre offre pour « ${params.jobTitle} » a été acceptée. Détails : ${url}`,
      { kind: "accepted", jobTitle: params.jobTitle, url }
    );
  },
};
