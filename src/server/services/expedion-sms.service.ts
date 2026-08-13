/**
 * ============================================================================
 * Twilio SMS — Expedion Phase B
 * ============================================================================
 *
 * Three moments earn an SMS (expedion_encheres ROADMAP.md §8 Phase B): the
 * devis is ready, a driver is assigned, and the delivery status moves.
 *
 * Called over the REST API rather than the Twilio SDK — one authenticated POST
 * does not justify a dependency, and it keeps the bundle out of the serverless
 * cold path.
 *
 * Every send is best-effort. A failed SMS must never fail the operation that
 * triggered it: a client whose quote was priced but whose SMS bounced still
 * has a priced quote.
 */

export interface SmsResult {
  sent: boolean;
  sid?: string;
  skippedReason?: string;
  error?: string;
}

function config() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM_NUMBER,
  };
}

/**
 * Normalises a French number to E.164.
 *
 * Airtable holds these as free text — "06 12 34 56 78", "+33612345678",
 * "0033 6 12 34 56 78" all appear. Anything we cannot confidently normalise is
 * returned as null and the send is skipped rather than guessed at.
 */
export function toE164Fr(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.replace(/[\s.\-()]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (s.startsWith("+")) return /^\+\d{8,15}$/.test(s) ? s : null;
  // Domestic form: 0X XX XX XX XX.
  if (/^0\d{9}$/.test(s)) return `+33${s.slice(1)}`;
  return null;
}

async function send(to: string, body: string): Promise<SmsResult> {
  const { accountSid, authToken, from } = config();
  if (!accountSid || !authToken || !from) {
    return { sent: false, skippedReason: "TWILIO_NOT_CONFIGURED" };
  }

  const e164 = toE164Fr(to);
  if (!e164) return { sent: false, skippedReason: "INVALID_PHONE" };

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${accountSid}:${authToken}`
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: e164, From: from, Body: body }),
      }
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[expedion] Twilio send failed", res.status, detail);
      return { sent: false, error: `TWILIO_${res.status}` };
    }

    const json = (await res.json()) as { sid?: string };
    return { sent: true, sid: json.sid };
  } catch (error) {
    console.error("[expedion] Twilio request threw", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "UNKNOWN",
    };
  }
}

const euros = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
  });

export const expedionSmsService = {
  send,

  /** The devis has a price and is waiting on the client. */
  async quoteReady(params: {
    phone: string | null;
    firstName?: string | null;
    bordereauNumber?: string | null;
    priceCents?: number | null;
  }): Promise<SmsResult> {
    const who = params.firstName ? `${params.firstName}, v` : "V";
    const ref = params.bordereauNumber
      ? ` (bordereau ${params.bordereauNumber})`
      : "";
    const price = params.priceCents
      ? ` Montant : ${euros(params.priceCents)}.`
      : "";
    return send(
      params.phone ?? "",
      `${who}otre devis Expedion est prêt${ref}.${price} Consultez-le dans l'application pour le valider.`
    );
  },

  /** An admin picked a driver from the pool. */
  async driverAssigned(params: {
    phone: string | null;
    firstName?: string | null;
    pickupCity?: string | null;
  }): Promise<SmsResult> {
    const who = params.firstName ? `${params.firstName}, u` : "U";
    const where = params.pickupCity ? ` à ${params.pickupCity}` : "";
    return send(
      params.phone ?? "",
      `${who}n transporteur a été assigné à votre retrait${where}. Suivez la livraison dans l'application Expedion.`
    );
  },

  /** Pickup, in transit, delivered. */
  async deliveryUpdate(params: {
    phone: string | null;
    status: "picked_up" | "delivered" | "escalated";
    bordereauNumber?: string | null;
  }): Promise<SmsResult> {
    const ref = params.bordereauNumber
      ? ` (bordereau ${params.bordereauNumber})`
      : "";
    const message = {
      picked_up: `Votre lot a été retiré chez la maison de ventes${ref}. Livraison en cours.`,
      delivered: `Votre lot a été livré${ref}. Merci d'avoir utilisé Expedion.`,
      escalated: `Nous mettons votre transport${ref} en concurrence auprès de notre réseau de transporteurs afin de vous proposer la meilleure offre.`,
    }[params.status];
    return send(params.phone ?? "", message);
  },

  /**
   * Gardiennage warning — the conversion lever. Auction houses start charging
   * daily storage after a grace period, so the countdown is the reason a
   * hesitating buyer books.
   */
  async storageWarning(params: {
    phone: string | null;
    daysRemaining: number;
    dailyFeeCents?: number | null;
  }): Promise<SmsResult> {
    const fee = params.dailyFeeCents
      ? ` Au-delà, des frais de ${euros(params.dailyFeeCents)}/jour s'appliquent.`
      : "";
    const days =
      params.daysRemaining <= 0
        ? "Les frais de gardiennage ont commencé à courir."
        : `Il vous reste ${params.daysRemaining} jour${
            params.daysRemaining > 1 ? "s" : ""
          } avant les frais de gardiennage.`;
    return send(params.phone ?? "", `${days}${fee} Organisez le retrait dès maintenant sur Expedion.`);
  },
};
