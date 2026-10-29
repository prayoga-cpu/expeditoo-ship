import { getUserById } from "@/server/dal/users.dal";
import { emailService } from "@/server/services/email.service";
import { notificationsService } from "@/server/services/notifications.service";
import { formatCurrency } from "@/lib/currency";

/**
 * « An email to the driver for every payout » (client_feedback_2026_10_29_spec.md
 * §N6): at delivery, when the job adds to what they are owed, and when an
 * operator records the transfer. Best-effort and never thrown — a notice must
 * not undo a delivery or a settlement — and in-app as well as by email, since
 * until a sending domain is verified (C4) the email reaches only the Resend
 * account's own address.
 */

const earningsUrl = () =>
  `${process.env.NEXT_PUBLIC_APP_URL ?? "https://expeditoo.com"}/carrier/withdrawals`;

async function send(
  carrierUserId: string,
  kind: "earned" | "paid",
  amountCents: number,
  extra: { jobTitle?: string | null; transferReference?: string | null }
) {
  const amountLabel = formatCurrency(amountCents);
  const driver = await getUserById(carrierUserId);
  if (!driver?.email) return;
  await emailService.sendPayoutEmail(driver.email, {
    kind,
    recipientName: driver.name,
    amountLabel,
    earningsUrl: earningsUrl(),
    ...extra,
  });
}

export const payoutNoticesService = {
  /** A delivery added to the driver's balance. */
  async earned(carrierUserId: string, amountCents: number, jobTitle?: string | null) {
    await Promise.allSettled([
      notificationsService.createNotification({
        userId: carrierUserId,
        type: "payout_scheduled",
        title: "Payment added to your balance",
        message: `${formatCurrency(amountCents)} are owed to you for this delivery.`,
        linkUrl: "/carrier/withdrawals",
      }),
      send(carrierUserId, "earned", amountCents, { jobTitle }),
    ]).then((results) =>
      results
        .filter((r) => r.status === "rejected")
        .forEach((r) => console.error("payout notice failed", (r as PromiseRejectedResult).reason))
    );
  },

  /** An operator recorded the transfer. The in-app notice is the caller's. */
  async paid(carrierUserId: string, amountCents: number, transferReference?: string | null) {
    await send(carrierUserId, "paid", amountCents, { transferReference }).catch((e) =>
      console.error("payout email failed", e)
    );
  },
};
