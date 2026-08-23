import { nanoid } from "nanoid";
import { db } from "@/db";
import { expedionDal, type QuoteFilters } from "@/server/dal/expedion.dal";
import { pricingService } from "@/server/services/pricing.service";
import { expedionSmsService } from "@/server/services/expedion-sms.service";
import { expedionExtractionService } from "@/server/services/expedion-extraction.service";
import {
  expedionPriceSuggestionService,
  type PriceSuggestion,
} from "@/server/services/expedion-price-suggestion.service";
import { notifyExpedionAdmins } from "@/server/services/expedion-realtime.service";
import { imageUrlToBase64DataUrl } from "@/lib/ai/openai";
import { searchAddress } from "@/lib/geocoding";
import type {
  CreateExpedionQuoteInput,
  UpdateExpedionQuoteInput,
  AdminUpdateExpedionQuoteInput,
  AcceptExpedionQuoteInput,
} from "@/server/dto/expedion.dto";
import type {
  ExpedionQuote,
  ExpedionQuoteStatus,
  InsertExpedionQuote,
} from "@/db/schema/expedion";

/**
 * Who is asking, as far as this service is concerned.
 *
 * Declared structurally rather than imported from `@/lib/expedion-auth` so the
 * service does not pull in Better Auth — and through it the database adapter —
 * merely to name a shape. `ExpedionCaller` satisfies this by structure.
 *
 * `userId` is a Better Auth user id for session callers and a Firebase UID for
 * legacy shared-key callers. It is compared against
 * `expedion_quotes.firebase_uid`, whose name predates the migration and now
 * means "owner".
 */
export interface ExpedionCallerIdentity {
  userId: string;
  isAdmin: boolean;
}

// ========================================
// Errors
// ========================================

export class ExpedionError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "ExpedionError";
  }
}

const err = (code: string, status: number, message?: string) =>
  new ExpedionError(code, status, message);

// ========================================
// Policy
// ========================================

/**
 * Ad valorem insurance premium, as a fraction of the declared value.
 *
 * The second price on every devis is `standard + ad valorem`. 1.2% is the rate
 * the current Airtable base prices at; it is a business input, not a constant
 * of nature, so it lives here rather than being inlined.
 */
export const AD_VALOREM_RATE = 0.012;

/** Floor on the insurance line, so trivially-valued lots still carry cost. */
export const AD_VALOREM_MINIMUM_CENTS = 500;

/**
 * How long a paid job waits for an admin to assign a driver before it
 * escalates to the Expeditoo marketplace.
 *
 * Open decision #1 in both roadmaps. 48h is the placeholder: long enough for a
 * human to work a queue over a weekday, short enough to stay inside the
 * ten-day gardiennage grace period with room to spare. Override per
 * environment with EXPEDION_ESCALATE_AFTER_HOURS.
 */
export const DEFAULT_ESCALATE_AFTER_HOURS = 48;

export function escalationWindowHours(): number {
  const raw = process.env.EXPEDION_ESCALATE_AFTER_HOURS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_ESCALATE_AFTER_HOURS;
}

/**
 * Legal status transitions. Anything not listed is rejected, which is the
 * whole reason for collapsing Airtable's five independent columns into one
 * ordered enum.
 */
const TRANSITIONS: Record<ExpedionQuoteStatus, ExpedionQuoteStatus[]> = {
  pending: ["awaiting_confirmation", "quoted", "cancelled"],
  awaiting_confirmation: ["quoted", "pending", "cancelled"],
  quoted: ["accepted", "cancelled"],
  accepted: ["paid", "cancelled"],
  paid: ["assigned", "escalated", "cancelled"],
  assigned: ["picked_up", "escalated", "cancelled"],
  escalated: ["assigned", "picked_up", "cancelled"],
  picked_up: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function canTransition(
  from: ExpedionQuoteStatus,
  to: ExpedionQuoteStatus
): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/**
 * The fields `adminUpdate` refuses once the quote is paid.
 *
 * Named once here because `quoteCapabilities` on the client mirrors this list
 * to decide whether to offer the buttons at all, and the two drifting apart is
 * how an operator gets a form that only ever 409s.
 */
/**
 * The floor `escalationBlockers` enforces on `acceptedPriceCents`. Named here
 * because the price lock's carve-out has to agree with it: a value that would
 * still block escalation is not a repair.
 */
export const MIN_ESCALATABLE_PRICE_CENTS = 100;

export const PRICE_FIELDS = [
  "quoteStandardCents",
  "quoteInsuredCents",
  "quoteAvailable",
  "acceptedPriceCents",
] as const satisfies readonly (keyof AdminUpdateExpedionQuoteInput)[];

// ========================================
// Helpers
// ========================================

/** Volumetric weight, matching the Expeditoo pricing engine's divisor. */
export function hasDimensions(q: {
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  weightKg: number | null;
}): boolean {
  return (
    !!q.lengthCm && !!q.widthCm && !!q.heightCm && !!q.weightKg
  );
}

/** The ad valorem line: a floor-protected percentage of the declared value. */
export function adValoremInsuranceCents(
  declaredValueCents: number | null
): number {
  return declaredValueCents
    ? Math.max(
        AD_VALOREM_MINIMUM_CENTS,
        Math.round(declaredValueCents * AD_VALOREM_RATE)
      )
    : AD_VALOREM_MINIMUM_CENTS;
}

export async function geocodeFr(
  address: string | null | undefined,
  postalCode: string | null | undefined,
  city: string | null | undefined
): Promise<{ lat: number; lng: number } | null> {
  const query = [address, postalCode, city].filter(Boolean).join(", ");
  if (query.trim().length < 3) return null;
  try {
    const [hit] = await searchAddress(query, "fr", 1);
    if (!hit) return null;
    // Nominatim results carry `center` as [lng, lat].
    const [lng, lat] = hit.center;
    return { lat, lng };
  } catch {
    // Geocoding is best-effort: a quote without coordinates simply cannot be
    // auto-priced, and falls back to manual pricing by an admin.
    return null;
  }
}

/**
 * Whether this write *supplies* a price the quote never had, rather than
 * *changing* one it was paid at.
 *
 * The lock exists so a recorded amount cannot drift from what Stripe captured.
 * It is not meant to strand a row that carries no amount at all — and 95 live
 * paid quotes do, because the Airtable import brought a settled payment across
 * without an accepted price. Those can never escalate (`escalationBlockers`
 * demands `acceptedPriceCents >= 100`), and after the lock shipped the detail
 * dialog was the only surface that could repair them and it had gone read-only.
 *
 * Narrow on purpose: only `acceptedPriceCents`, only when the stored value is
 * missing or below the escalation floor, and only to a value that clears it.
 * Overwriting a real settled price stays refused.
 */
function isSupplyingMissingPrice(
  quote: ExpedionQuote,
  field: (typeof PRICE_FIELDS)[number],
  input: AdminUpdateExpedionQuoteInput
): boolean {
  if (field !== "acceptedPriceCents") return false;
  const stored = quote.acceptedPriceCents;
  if (stored != null && stored >= MIN_ESCALATABLE_PRICE_CENTS) return false;
  const next = input.acceptedPriceCents;
  return typeof next === "number" && next >= MIN_ESCALATABLE_PRICE_CENTS;
}

/**
 * The Stripe Checkout session behind a quote's payment, from the event
 * `markPaid` wrote.
 *
 * There is no column for it. `markPaid` records whatever the payment server
 * reported as free-form metadata (`{ reference, method }`) precisely because
 * this side never interprets it — but a refund has to be issued against
 * something, and this is the only handle that exists.
 */
async function findPaymentReference(quoteId: string): Promise<string | null> {
  const events = await expedionDal.listEvents(quoteId);
  for (let i = events.length - 1; i >= 0; i--) {
    const meta = events[i].metadata as Record<string, unknown> | null;
    const reference = meta?.reference;
    if (typeof reference === "string" && reference) return reference;
  }
  return null;
}

/**
 * Resolves coordinates for whichever side of a quote has a full address but
 * no lat/lng yet, and persists whatever it finds.
 *
 * `autoPrice` already geocodes pickup/delivery — but only once dimensions are
 * known, since coordinates there are a means to a price. A quote submitted
 * with a complete address and no dimensions yet (the common case for the
 * bordereau flow, which collects dimensions later in confirm-details) would
 * otherwise sit with `pickupLat`/`pickupLng` null until an admin filled
 * dimensions by hand — which is also the fact `escalationBlockers` (see
 * `expedion-escalation.service.ts`) checks to decide whether a quote is ready
 * to publish. Running this independently of `hasDimensions` closes that gap:
 * an address alone is enough to clear the coordinate blockers, exactly as an
 * admin manually placing the pin on the map would.
 *
 * Coordinates are still never client-supplied (see the comment on
 * `adminUpdateExpedionQuoteSchema` in `expedion.dto.ts`) — this only ever
 * writes back what the server's own geocoder resolved.
 */
async function geocodeMissingCoordinates(id: string): Promise<void> {
  const quote = await expedionDal.getById(id);
  if (!quote) return;

  const patch: Partial<InsertExpedionQuote> = {};

  if (
    (quote.pickupLat == null || quote.pickupLng == null) &&
    quote.pickupAddress &&
    quote.pickupPostalCode &&
    quote.pickupCity
  ) {
    const hit = await geocodeFr(
      quote.pickupAddress,
      quote.pickupPostalCode,
      quote.pickupCity
    );
    if (hit) {
      patch.pickupLat = hit.lat;
      patch.pickupLng = hit.lng;
    }
  }

  if (
    (quote.deliveryLat == null || quote.deliveryLng == null) &&
    quote.deliveryAddress &&
    quote.deliveryPostalCode &&
    quote.deliveryCity
  ) {
    const hit = await geocodeFr(
      quote.deliveryAddress,
      quote.deliveryPostalCode,
      quote.deliveryCity
    );
    if (hit) {
      patch.deliveryLat = hit.lat;
      patch.deliveryLng = hit.lng;
    }
  }

  if (Object.keys(patch).length > 0) {
    await expedionDal.update(id, patch);
  }
}

function toInsert(
  firebaseUid: string,
  input: CreateExpedionQuoteInput
): InsertExpedionQuote {
  return {
    id: nanoid(),
    firebaseUid,
    bordereauNumber: input.bordereauNumber ?? null,
    bordereauPaid: input.bordereauPaid ?? false,
    bordereauDocUrl: input.bordereauDocUrl ?? null,
    photoUrls: input.photoUrls ?? null,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    clientAddress: input.clientAddress ?? null,
    clientPostalCode: input.clientPostalCode ?? null,
    clientCity: input.clientCity ?? null,
    clientCountry: input.clientCountry ?? null,
    auctionHouseName: input.auctionHouseName ?? null,
    pickupAddress: input.pickupAddress ?? null,
    pickupPostalCode: input.pickupPostalCode ?? null,
    pickupCity: input.pickupCity ?? null,
    pickupPhone: input.pickupPhone ?? null,
    saleDate: input.saleDate ?? null,
    recipientName: input.recipientName ?? null,
    deliveryAddress: input.deliveryAddress ?? null,
    deliveryAddressLine2: input.deliveryAddressLine2 ?? null,
    deliveryPostalCode: input.deliveryPostalCode ?? null,
    deliveryCity: input.deliveryCity ?? null,
    deliveryCountry: input.deliveryCountry ?? null,
    deliveryPhone: input.deliveryPhone ?? null,
    description: input.description ?? null,
    lengthCm: input.lengthCm ?? null,
    widthCm: input.widthCm ?? null,
    heightCm: input.heightCm ?? null,
    weightKg: input.weightKg ?? null,
    isProtected: input.isProtected ?? false,
    declaredValueCents: input.declaredValueCents ?? null,
    valueBracket: input.valueBracket ?? null,
    comment: input.comment ?? null,
    storageFreeUntil: input.storageFreeUntil ?? null,
    storageDailyFeeCents: input.storageDailyFeeCents ?? null,
    status: "pending",
  };
}

// ========================================
// Service
// ========================================

export const expedionService = {
  async createQuote(ownerId: string, input: CreateExpedionQuoteInput) {
    const quote = await db.transaction(async (tx) => {
      const created = await expedionDal.create(
        toInsert(ownerId, input),
        tx
      );
      await expedionDal.addEvent(
        {
          id: nanoid(),
          quoteId: created.id,
          status: "pending",
          actor: "client",
          actorId: ownerId,
          message: "Demande de devis reçue",
        },
        tx
      );
      return created;
    });

    // A new quote is exactly what the dashboard's "Recent quotes" panel
    // exists to surface; an operator watching it should see this land
    // without a refresh.
    void notifyExpedionAdmins(quote.id);

    // Priced outside the transaction: it geocodes over the network, and a
    // quote that fails to auto-price is still a valid quote awaiting an admin.
    void this.autoPrice(quote.id).catch((e) =>
      console.error("[expedion] auto-price failed", quote.id, e)
    );

    // Independent of pricing: a quote submitted with a full address but no
    // dimensions yet (the bordereau flow) would otherwise never get
    // coordinates until an admin filled dimensions by hand. See
    // `geocodeMissingCoordinates`.
    void geocodeMissingCoordinates(quote.id).catch((e) =>
      console.error("[expedion] geocode failed", quote.id, e)
    );

    // A bordereau submitted with the quote gets read immediately — an
    // operator (or the client, on their own quote) should never have to
    // click a button first. `reextractDocument` only fills what is still
    // null, so this cannot clobber anything the client already typed, and it
    // is what records `extractionConfidence`, which is what tells the detail
    // view this quote's fields came from the model rather than the client.
    if (input.bordereauDocUrl) {
      void this.reextractDocument(quote.id, { actor: "system" }).catch((e) =>
        console.error("[expedion] auto-extract failed", quote.id, e)
      );
    }

    return quote;
  },

  async getQuote(id: string, caller: ExpedionCallerIdentity) {
    const quote = await expedionDal.getById(id);
    if (!quote) throw err("QUOTE_NOT_FOUND", 404);
    if (!caller.isAdmin && quote.firebaseUid !== caller.userId) {
      // 404 rather than 403: a non-owner should not learn the id exists.
      throw err("QUOTE_NOT_FOUND", 404);
    }
    return quote;
  },

  async listQuotes(filters: QuoteFilters) {
    return await expedionDal.list(filters);
  },

  async updateQuote(
    id: string,
    caller: ExpedionCallerIdentity,
    input: UpdateExpedionQuoteInput
  ) {
    const quote = await this.getQuote(id, caller);

    if (!caller.isAdmin && !["pending", "awaiting_confirmation", "quoted"].includes(quote.status)) {
      throw err(
        "QUOTE_LOCKED",
        409,
        "Le devis ne peut plus être modifié à ce stade"
      );
    }

    const { confirmExtraction, ...fields } = input;
    const patch: Partial<InsertExpedionQuote> = { ...fields };

    if (confirmExtraction) {
      patch.extractionConfirmedAt = new Date();
      if (quote.status === "awaiting_confirmation") patch.status = "pending";
    }

    const pickupAddressChanged =
      fields.pickupAddress !== undefined ||
      fields.pickupCity !== undefined ||
      fields.pickupPostalCode !== undefined;
    const deliveryAddressChanged =
      fields.deliveryAddress !== undefined ||
      fields.deliveryCity !== undefined ||
      fields.deliveryPostalCode !== undefined;
    const dimensionsOrAddressChanged =
      fields.lengthCm !== undefined ||
      fields.widthCm !== undefined ||
      fields.heightCm !== undefined ||
      fields.weightKg !== undefined ||
      pickupAddressChanged ||
      deliveryAddressChanged;

    // A stale AI estimate is worse than none — it was grounded in the
    // values being changed here.
    if (dimensionsOrAddressChanged && quote.aiSuggestedAt) {
      patch.aiSuggestedStandardCents = null;
      patch.aiSuggestedInsuredCents = null;
      patch.aiSuggestionReasoning = null;
      patch.aiSuggestionEstimations = null;
      patch.aiSuggestionConfidence = null;
      patch.aiSuggestionSource = null;
      patch.aiSuggestedAt = null;
    }

    // Stale coordinates are worse than none: `geocodeMissingCoordinates`
    // below only fills a lat/lng that is *null*, so an edited address would
    // otherwise keep pointing at the old one forever. The client-facing
    // schema never carries pickupLat/pickupLng itself (see the comment on
    // `adminUpdateExpedionQuoteSchema`), so clearing them here cannot
    // clobber a value this same request just set.
    if (pickupAddressChanged) {
      patch.pickupLat = null;
      patch.pickupLng = null;
    }
    if (deliveryAddressChanged) {
      patch.deliveryLat = null;
      patch.deliveryLng = null;
    }

    const updated = await expedionDal.update(id, patch);
    void notifyExpedionAdmins(id);

    // Dimensions drive the price, so a corrected dimension reprices.
    if (dimensionsOrAddressChanged) {
      void this.autoPrice(id).catch((e) =>
        console.error("[expedion] reprice failed", id, e)
      );
      void geocodeMissingCoordinates(id).catch((e) =>
        console.error("[expedion] geocode failed", id, e)
      );
    }

    return updated;
  },

  /**
   * The client-facing counterpart to `expedionPriceSuggestionService.suggest`:
   * ownership-checked, cached on the quote so a reopened sheet does not
   * re-run GPT-4.1 vision, and refused once the quote has a real price —
   * at that point the estimate is moot and letting a client keep
   * triggering it is pure cost with no upside.
   */
  async getPriceSuggestion(
    id: string,
    caller: ExpedionCallerIdentity
  ): Promise<PriceSuggestion> {
    const quote = await this.getQuote(id, caller);

    if (quote.quoteAvailable) {
      throw err(
        "QUOTE_ALREADY_PRICED",
        409,
        "Le devis est déjà chiffré, l'estimation IA n'est plus disponible."
      );
    }

    if (
      quote.aiSuggestedAt &&
      quote.aiSuggestedStandardCents != null &&
      quote.aiSuggestedInsuredCents != null
    ) {
      return {
        standardCents: quote.aiSuggestedStandardCents,
        insuredCents: quote.aiSuggestedInsuredCents,
        reasoning: quote.aiSuggestionReasoning ?? "",
        estimations: (quote.aiSuggestionEstimations as string[] | null) ?? [],
        confidence: quote.aiSuggestionConfidence ?? 0,
        source: (quote.aiSuggestionSource as PriceSuggestion["source"]) ?? "engine",
      };
    }

    const suggestion = await expedionPriceSuggestionService.suggest(id);

    await db
      .transaction(async (tx) => {
        await expedionDal.update(
          id,
          {
            aiSuggestedStandardCents: suggestion.standardCents,
            aiSuggestedInsuredCents: suggestion.insuredCents,
            aiSuggestionReasoning: suggestion.reasoning,
            aiSuggestionEstimations: suggestion.estimations,
            aiSuggestionConfidence: suggestion.confidence,
            aiSuggestionSource: suggestion.source,
            aiSuggestedAt: new Date(),
          },
          tx
        );
        await expedionDal.addEvent(
          {
            id: nanoid(),
            quoteId: id,
            status: quote.status,
            actor: "system",
            message: "Estimation IA générée pour le client",
            metadata: {
              standardCents: suggestion.standardCents,
              insuredCents: suggestion.insuredCents,
              source: suggestion.source,
              confidence: suggestion.confidence,
            },
          },
          tx
        );
      })
      // The client already has the suggestion (and it was already computed);
      // losing the cache write just means the next open recomputes.
      .catch((e) => console.error("[expedion] failed to cache AI suggestion", id, e));

    return suggestion;
  },

  /**
   * Re-reads the bordereau already stored on a quote and refills whatever
   * the model finds — client identity, pickup, the lot. For a devis an
   * operator is helping a stuck client finish: the client uploaded a
   * document once but never confirmed the extracted details, or the initial
   * extraction ran thin. This is the same model and schema
   * `POST /api/expedion/extract` uses at upload time, pointed at the URL
   * already on the row instead of a fresh client upload.
   *
   * Also the call `createQuote` makes on itself right after a bordereau is
   * submitted, with `opts.actor: "system"` — the route above stays admin-
   * gated (a supervision tool, re-run by a human), but the underlying work
   * is the same either way, so it is one function rather than two copies of
   * the merge-and-record logic drifting apart.
   */
  async reextractDocument(
    id: string,
    opts: { actor?: "admin" | "system"; message?: string } = {}
  ) {
    const quote = await expedionDal.getById(id);
    if (!quote) throw err("QUOTE_NOT_FOUND", 404);
    if (!quote.bordereauDocUrl) {
      throw err("NO_DOCUMENT", 422, "Aucun bordereau à analyser pour ce devis");
    }

    const dataUrl = await imageUrlToBase64DataUrl(quote.bordereauDocUrl);
    if (!dataUrl) {
      throw err("NO_DOCUMENT", 422, "Le document est introuvable ou illisible");
    }
    const mimeType =
      dataUrl.match(/^data:([^;]+);base64,/)?.[1] ?? "application/octet-stream";

    const outcome = await expedionExtractionService.extract({
      data: dataUrl,
      mimeType,
      filename: "bordereau",
    });

    const patch = expedionExtractionService.toQuotePatch(outcome.extraction);
    // Same rule as the upload-time extraction: only overwrite what the model
    // actually filled, so a re-run never blanks a field someone already
    // corrected by hand.
    const nonNull = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== null && v !== undefined)
    );

    const updated = await db.transaction(async (tx) => {
      const row = await expedionDal.update(
        id,
        {
          ...nonNull,
          extraction: outcome.extraction,
          extractionModel: outcome.model,
          extractionConfidence: outcome.extraction.confidence,
          status:
            quote.status === "pending" ? "awaiting_confirmation" : quote.status,
        },
        tx
      );
      await expedionDal.addEvent(
        {
          id: nanoid(),
          quoteId: id,
          status: row.status,
          actor: opts.actor ?? "admin",
          message:
            opts.message ??
            (opts.actor === "system"
              ? "Champs pré-remplis automatiquement par l'IA à la réception"
              : "Document ré-analysé par l'IA depuis la supervision"),
          metadata: { model: outcome.model, missingFields: outcome.missingFields },
        },
        tx
      );
      return row;
    });

    void notifyExpedionAdmins(id);

    // Dimensions may just have appeared or changed; give auto-pricing another
    // shot the same way a client-side dimension edit would.
    void this.autoPrice(id).catch((e) =>
      console.error("[expedion] reprice after reextract failed", id, e)
    );

    return { quote: updated, missingFields: outcome.missingFields, model: outcome.model };
  },

  /**
   * Prices a quote from its extracted dimensions, using the same engine that
   * prices Expeditoo listings so the two products never quote differently for
   * the same journey.
   *
   * A no-op when dimensions or coordinates are missing — those quotes wait for
   * an admin rather than getting a price built on guesses.
   */
  async autoPrice(id: string): Promise<ExpedionQuote | null> {
    const quote = await expedionDal.getById(id);
    if (!quote) throw err("QUOTE_NOT_FOUND", 404);
    // A settled price is not the engine's to revise. This runs in the
    // background off `createQuote`, `updateQuote` and `reextractDocument` — and
    // re-extracting a paid quote's bordereau would otherwise rewrite the very
    // figures `adminUpdate` refuses to let an operator touch, straight past
    // PRICE_LOCKED. Returns null rather than throwing: the callers are all
    // fire-and-forget, and "nothing to price here" is the honest answer.
    if (quote.paymentStatus === "paid") return null;
    if (!hasDimensions(quote)) return null;

    const pickup =
      quote.pickupLat != null && quote.pickupLng != null
        ? { lat: quote.pickupLat, lng: quote.pickupLng }
        : await geocodeFr(
            quote.pickupAddress,
            quote.pickupPostalCode,
            quote.pickupCity
          );

    const dropoff =
      quote.deliveryLat != null && quote.deliveryLng != null
        ? { lat: quote.deliveryLat, lng: quote.deliveryLng }
        : await geocodeFr(
            quote.deliveryAddress,
            quote.deliveryPostalCode,
            quote.deliveryCity
          );

    if (!pickup || !dropoff) return null;

    const result = pricingService.calculatePrice({
      origin: pickup,
      destination: dropoff,
      package: {
        length: quote.lengthCm!,
        width: quote.widthCm!,
        height: quote.heightCm!,
        weight: quote.weightKg!,
      },
      speed: "STANDARD",
    });

    const standardCents = Math.round(result.breakdown.total * 100);
    const insuranceCents = adValoremInsuranceCents(quote.declaredValueCents);

    const updated = await db.transaction(async (tx) => {
      const row = await expedionDal.update(
        id,
        {
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          deliveryLat: dropoff.lat,
          deliveryLng: dropoff.lng,
          quoteStandardCents: standardCents,
          quoteInsuredCents: standardCents + insuranceCents,
          quoteAvailable: true,
          status: canTransition(quote.status, "quoted")
            ? "quoted"
            : quote.status,
        },
        tx
      );
      await expedionDal.addEvent(
        {
          id: nanoid(),
          quoteId: id,
          status: row.status,
          actor: "system",
          message: "Devis calculé automatiquement",
          metadata: {
            distanceKm: result.distance.km,
            billableWeightKg: result.weight.billable,
            volumeM3: result.volume.m3,
            standardCents,
            insuredCents: standardCents + insuranceCents,
          },
        },
        tx
      );
      return row;
    });

    // Notified only on the first pricing — repricing an already-quoted job
    // should not text the client again.
    if (!quote.quoteAvailable) {
      void expedionSmsService
        .quoteReady({
          phone: updated.phone,
          firstName: updated.firstName,
          bordereauNumber: updated.bordereauNumber,
          priceCents: standardCents,
        })
        .catch(() => undefined);
    }

    void notifyExpedionAdmins(id);
    return updated;
  },

  async acceptQuote(
    id: string,
    caller: ExpedionCallerIdentity,
    input: AcceptExpedionQuoteInput
  ) {
    const quote = await this.getQuote(id, caller);
    if (!quote.quoteAvailable) throw err("QUOTE_NOT_PRICED", 409);
    if (!canTransition(quote.status, "accepted")) {
      throw err("INVALID_TRANSITION", 409);
    }

    const price =
      input.kind === "standard"
        ? quote.quoteStandardCents
        : quote.quoteInsuredCents;
    if (price == null) throw err("QUOTE_NOT_PRICED", 409);

    const updated = await db.transaction(async (tx) => {
      const row = await expedionDal.update(
        id,
        {
          status: "accepted",
          acceptedKind: input.kind,
          acceptedPriceCents: price,
        },
        tx
      );
      await expedionDal.addEvent(
        {
          id: nanoid(),
          quoteId: id,
          status: "accepted",
          actor: "client",
          actorId: caller.userId,
          message: "Devis accepté par le client",
          metadata: { kind: input.kind, priceCents: price },
        },
        tx
      );
      return row;
    });

    void notifyExpedionAdmins(id);
    return updated;
  },

  /**
   * Marks a quote paid and starts the auto-escalation clock. Called by the
   * Stripe webhook once payment settles.
   */
  async markPaid(id: string, metadata?: Record<string, unknown>) {
    const quote = await expedionDal.getById(id);
    if (!quote) throw err("QUOTE_NOT_FOUND", 404);
    if (quote.paymentStatus === "paid") return quote; // idempotent

    // Refused rather than half-written. This used to keep the old status when
    // the move was illegal, which produced `payment_status = 'paid'` on a
    // `quoted` row — a combination every capability in the fork reads as
    // "nothing to do": unpriceable, undispatchable, and not re-quotable
    // either. `cancelAndRequote` makes that reachable, because the Expedion
    // success page re-posts this endpoint from `initState` on every mount and
    // the payment server replays it for as long as Stripe still reports the
    // session paid. An operator who deliberately reopened a quote must not
    // have it re-settled behind them by a stale session id.
    if (!canTransition(quote.status, "paid")) {
      throw err(
        "INVALID_TRANSITION",
        409,
        `A payment cannot be recorded against a quote at ${quote.status}`
      );
    }

    const escalateAfter = new Date(
      Date.now() + escalationWindowHours() * 60 * 60 * 1000
    );

    const updated = await db.transaction(async (tx) => {
      const row = await expedionDal.update(
        id,
        {
          paymentStatus: "paid",
          status: "paid",
          escalateAfter,
        },
        tx
      );
      await expedionDal.addEvent(
        {
          id: nanoid(),
          quoteId: id,
          status: row.status,
          actor: "system",
          message: "Paiement reçu",
          metadata: { ...metadata, escalateAfter: escalateAfter.toISOString() },
        },
        tx
      );
      return row;
    });

    void notifyExpedionAdmins(id);
    return updated;
  },

  async adminUpdate(id: string, input: AdminUpdateExpedionQuoteInput) {
    const quote = await expedionDal.getById(id);
    if (!quote) throw err("QUOTE_NOT_FOUND", 404);

    // A paid price is settled. `acceptedPriceCents` is what Stripe actually
    // charged and what becomes the marketplace `budgetCents` on escalation;
    // the other three are what the client was shown. Editing any of them
    // after settlement puts the recorded amount and the captured one out of
    // step, and moves the bid ceiling off money that exists.
    //
    // Keyed on `paymentStatus`, not `status`: a quote can be `escalated` or
    // `picked_up` and still carry the price it was paid at, and one refunded
    // back to `unpaid` by `cancelAndRequote` must become editable again.
    //
    // Addresses, coordinates, weight and storage terms stay editable at every
    // status — they are what `escalationBlockers` demands, and locking them
    // would strand a paid quote that cannot be published.
    if (quote.paymentStatus === "paid") {
      const locked = PRICE_FIELDS.filter(
        (f) => input[f] !== undefined && !isSupplyingMissingPrice(quote, f, input)
      );
      if (locked.length > 0) {
        throw err(
          "PRICE_LOCKED",
          409,
          `This quote has been paid; ${locked.join(", ")} can no longer be edited`
        );
      }
    }

    // Attaching a driver is no longer one of the edits this route accepts.
    // It used to be — `assignedCarrierId` in the patch implied a move to
    // `assigned` — and that was the whole defect: it wrote the column, texted
    // the client, and produced no listing, no shipment and no payment hold,
    // so the driver never saw the job and nothing but another hand-edit could
    // finish it. `expedionEscalationService.assignDirect` is the one way in.
    const nextStatus = input.status;

    if (nextStatus && !canTransition(quote.status, nextStatus)) {
      throw err(
        "INVALID_TRANSITION",
        409,
        `${quote.status} → ${nextStatus} is not a legal transition`
      );
    }

    const { note, ...fields } = input;
    const patch: Partial<InsertExpedionQuote> = { ...fields };

    // Now that an unmentioned field no longer arrives as `null`, a body that
    // names nothing produces an empty patch — and Drizzle answers an empty
    // `set()` with a raw throw. A patch that changes nothing is a caller
    // mistake, so it is named as one rather than surfacing as a 500.
    if (!Object.values(patch).some((v) => v !== undefined)) {
      throw err("NO_CHANGES", 400, "no fields to update");
    }

    const updated = await db.transaction(async (tx) => {
      const row = await expedionDal.update(id, patch, tx);
      await expedionDal.addEvent(
        {
          id: nanoid(),
          quoteId: id,
          status: row.status,
          actor: "admin",
          message: note ?? "Mise à jour par un administrateur",
          metadata: { changed: Object.keys(fields) },
        },
        tx
      );
      return row;
    });

    // The acting admin's own client already invalidates on this mutation's
    // success — this is for every other admin with the dashboard open.
    void notifyExpedionAdmins(id);

    // The driver-assigned text now rides on the write-back
    // (`expedionBridgeService.writeBack`), which is where a driver actually
    // becomes attached to a quote.
    if (
      input.status &&
      input.status !== quote.status &&
      (input.status === "picked_up" || input.status === "delivered")
    ) {
      void expedionSmsService
        .deliveryUpdate({
          phone: updated.phone,
          status: input.status,
          bordereauNumber: updated.bordereauNumber,
        })
        .catch(() => undefined);
    }

    return updated;
  },

  /**
   * Unwinds a settled quote so the client can be re-quoted.
   *
   * The correction path for a price that turns out to be wrong after the
   * client has paid. In-place editing is refused (`PRICE_LOCKED`) because it
   * would leave the recorded amount disagreeing with what Stripe captured;
   * this instead returns the quote to `quoted`, where the client accepts and
   * pays the corrected figure — so the two never disagree at any point.
   *
   * **This does not move money.** EXPEDITOO never took it: `expedion_quotes`
   * carries no payment intent or session, because the client pays on the
   * Expedion side and that side reports the settlement here (see
   * `POST /quotes/:id/paid`). `refundService` only knows about `payments`
   * rows, which are Expeditoo's own holds against shipments — there is no row
   * here for it to refund. What this does is unwind our record of the
   * payment and put the Stripe reference on the timeline, so whoever runs the
   * Expedion Stripe account can refund against it. Wiring that call is a
   * payment-server change, not one this repo can make.
   *
   * Refused once a listing or a driver exists: money is then held against a
   * shipment on our side too, and unwinding that is a cancellation, not a
   * re-quote.
   */
  async cancelAndRequote(id: string, actorId?: string) {
    const quote = await expedionDal.getById(id);
    if (!quote) throw err("QUOTE_NOT_FOUND", 404);
    if (quote.paymentStatus !== "paid") {
      throw err("NOT_PAID", 409, "This quote has not been paid");
    }
    // `paymentStatus` alone is not enough. 1085 imported rows sit at
    // `picked_up` with a settled payment, no carrier and no listing — the lot
    // was collected outside the system — and without this the correction path
    // would rewind a job already in transit back to `quoted`, wiping the price
    // the client paid. `paid` is the only status where the fork is genuinely
    // still open.
    if (quote.status !== "paid") {
      throw err(
        "NOT_AWAITING_DISPATCH",
        409,
        `A quote can only be re-quoted while it is awaiting a driver, not from ${quote.status}`
      );
    }
    if (quote.listingId || quote.assignedCarrierId) {
      throw err(
        "ALREADY_DISPATCHED",
        409,
        "This job is already with a driver or on the marketplace; cancel it instead"
      );
    }

    // The Checkout session the payment server reported, recovered from the
    // timeline — it is the only handle anyone has for issuing the refund, and
    // burying it in an old event is how it gets lost.
    const paymentReference = await findPaymentReference(id);
    const refundedCents = quote.acceptedPriceCents;

    const updated = await db.transaction(async (tx) => {
      const row = await expedionDal.update(
        id,
        {
          paymentStatus: "unpaid",
          // Written directly rather than through `canTransition`: `paid` has
          // no edge back to `quoted`, and it should not gain one. Rewinding a
          // settled quote is exactly the move the transition graph exists to
          // stop `adminUpdate` making by accident; it is legitimate only here,
          // where a refund is being recorded alongside it.
          status: "quoted",
          acceptedKind: null,
          acceptedPriceCents: null,
          escalateAfter: null,
        },
        tx
      );
      await expedionDal.addEvent(
        {
          id: nanoid(),
          quoteId: id,
          status: "quoted",
          actor: "admin",
          actorId,
          message: "Devis annulé et remis en cotation ; remboursement à émettre",
          metadata: {
            refundedCents,
            previousAcceptedKind: quote.acceptedKind,
            paymentReference,
            // Named so nobody reads this event as "the money is back".
            refundIssued: false,
          },
        },
        tx
      );
      return row;
    });

    void notifyExpedionAdmins(id);
    return { quote: updated, refundedCents, paymentReference };
  },

  async listEvents(id: string, caller: ExpedionCallerIdentity) {
    await this.getQuote(id, caller);
    return await expedionDal.listEvents(id);
  },
};
