import {
  pgTable,
  text,
  timestamp,
  integer,
  doublePrecision,
  boolean,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./users";
import { carriers } from "./carriers";
import { listings } from "./listings";

// ========================================
// Expedion Enchères — auction pickup quotes
// ========================================
//
// Expedion is the auction-specific front door to the same driver network
// Expeditoo serves (expedion_encheres/ROADMAP.md §1). A buyer wins a lot at a
// French auction house, uploads the bordereau, and gets a devis; an admin
// assigns a driver, and if nobody takes it the job escalates into `listings`
// where carriers bid.
//
// This table replaces the Airtable base the Flutter app reads today
// (ROADMAP.md §5). Column names are the English equivalents of the French
// Airtable columns; `airtableFields` preserves anything the import could not
// map, so the migration is never lossy.

/**
 * The devis lifecycle. Airtable spread this across five loosely-coupled
 * columns (`VALIDER DEVIS`, `STATUT DU PAIEMENT`, `PAIEMENT RECU`,
 * `Retrait fait`, `livraison fait`) which could disagree with one another.
 * One ordered enum makes the illegal states unrepresentable.
 */
export const expedionQuoteStatusEnum = pgEnum("expedion_quote_status", [
  /** Bordereau uploaded, awaiting extraction and pricing. */
  "pending",
  /** Extracted, awaiting the client's confirm-details step. */
  "awaiting_confirmation",
  /** Priced and visible to the client. */
  "quoted",
  /** Client accepted the price. */
  "accepted",
  /** Paid; ready for a driver. */
  "paid",
  /** Admin assigned a driver from the pool. */
  "assigned",
  /** No driver available — pushed to the Expeditoo marketplace. */
  "escalated",
  /** Collected from the auction house. */
  "picked_up",
  "delivered",
  "cancelled",
]);

export const expedionPaymentStatusEnum = pgEnum("expedion_payment_status", [
  "unpaid",
  "processing",
  "paid",
  "refunded",
]);

/** Which of the two prices the client accepted. */
export const expedionQuoteKindEnum = pgEnum("expedion_quote_kind", [
  "standard",
  "with_ad_valorem_insurance",
]);

// ========================================
// Quotes
// ========================================

export const expedionQuotes = pgTable(
  "expedion_quotes",
  {
    id: text("id").primaryKey(),

    // ---- Provenance ----
    // Set only by the one-time Airtable import, and unique so re-running the
    // import is idempotent rather than duplicating every row.
    airtableRecordId: text("airtable_record_id").unique(),
    /** Any Airtable column the import could not map, kept verbatim. */
    airtableFields: jsonb("airtable_fields"),

    // ---- Ownership ----
    // Expedion keeps Firebase Auth this phase (ROADMAP.md §5), so the Firebase
    // UID is the identity we can actually resolve. `userId` is the forward path
    // for when auth migrates onto Better Auth alongside Expeditoo.
    firebaseUid: text("firebase_uid").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

    // ---- Reference ----
    quoteNumber: text("quote_number"),
    bordereauNumber: text("bordereau_number"),
    bordereauPaid: boolean("bordereau_paid").default(false).notNull(),
    /** R2 key for the uploaded bordereau (PDF or photo). */
    bordereauDocUrl: text("bordereau_doc_url"),
    photoUrls: jsonb("photo_urls").$type<string[]>(),

    // ---- Client ----
    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text("email"),
    phone: text("phone"),
    clientAddress: text("client_address"),
    clientPostalCode: text("client_postal_code"),
    clientCity: text("client_city"),
    clientCountry: text("client_country"),

    // ---- Pickup: the auction house ----
    auctionHouseName: text("auction_house_name"),
    pickupAddress: text("pickup_address"),
    pickupPostalCode: text("pickup_postal_code"),
    pickupCity: text("pickup_city"),
    pickupPhone: text("pickup_phone"),
    pickupLat: doublePrecision("pickup_lat"),
    pickupLng: doublePrecision("pickup_lng"),
    saleDate: timestamp("sale_date"),

    // ---- Delivery ----
    recipientName: text("recipient_name"),
    deliveryAddress: text("delivery_address"),
    deliveryAddressLine2: text("delivery_address_line2"),
    deliveryPostalCode: text("delivery_postal_code"),
    deliveryCity: text("delivery_city"),
    deliveryCountry: text("delivery_country"),
    deliveryPhone: text("delivery_phone"),
    deliveryLat: doublePrecision("delivery_lat"),
    deliveryLng: doublePrecision("delivery_lng"),

    // ---- The lot ----
    description: text("description"),
    lengthCm: doublePrecision("length_cm"),
    widthCm: doublePrecision("width_cm"),
    heightCm: doublePrecision("height_cm"),
    weightKg: doublePrecision("weight_kg"),
    isProtected: boolean("is_protected").default(false).notNull(),
    /** Total TTC on the slip. */
    declaredValueCents: integer("declared_value_cents"),
    /** Airtable's banded value, e.g. "0 - 1000 €". Kept for pricing parity. */
    valueBracket: text("value_bracket"),

    // ---- Pricing ----
    quoteStandardCents: integer("quote_standard_cents"),
    quoteInsuredCents: integer("quote_insured_cents"),
    acceptedKind: expedionQuoteKindEnum("accepted_kind"),
    acceptedPriceCents: integer("accepted_price_cents"),
    /** True once an admin (or auto-pricing) has published a price. */
    quoteAvailable: boolean("quote_available").default(false).notNull(),

    // ---- Status ----
    status: expedionQuoteStatusEnum("status").default("pending").notNull(),
    paymentStatus: expedionPaymentStatusEnum("payment_status")
      .default("unpaid")
      .notNull(),

    // ---- Driver assignment (admin-selected, shared pool) ----
    assignedCarrierId: text("assigned_carrier_id").references(
      () => carriers.id,
      { onDelete: "set null" }
    ),
    assignedAt: timestamp("assigned_at"),

    // ---- Escalation bridge to Expeditoo (Phase D) ----
    /** The marketplace listing this quote became, once escalated. */
    listingId: text("listing_id").references(() => listings.id, {
      onDelete: "set null",
    }),
    escalatedAt: timestamp("escalated_at"),
    /**
     * When the auto-escalate timer fires. Set on `paid`; an admin can force
     * escalation early, which just escalates now and ignores this.
     */
    escalateAfter: timestamp("escalate_after"),

    // ---- Storage countdown (the conversion lever, ROADMAP.md §1) ----
    /**
     * Auction houses charge gardiennage after a grace period — Accord Enchères
     * bills €1–20/day after day ten. Surfacing the countdown is what converts.
     */
    storageFreeUntil: timestamp("storage_free_until"),
    storageDailyFeeCents: integer("storage_daily_fee_cents"),

    // ---- AI extraction (Phase B) ----
    /** Raw model output, kept so a bad extraction can be audited. */
    extraction: jsonb("extraction"),
    extractionModel: text("extraction_model"),
    extractionConfidence: doublePrecision("extraction_confidence"),
    /** Set when the client signs off the confirm-details screen. */
    extractionConfirmedAt: timestamp("extraction_confirmed_at"),

    // ---- Misc ----
    comment: text("comment"),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("expedion_quote_uid_idx").on(table.firebaseUid),
    index("expedion_quote_status_idx").on(table.status),
    index("expedion_quote_bordereau_idx").on(table.bordereauNumber),
    index("expedion_quote_listing_idx").on(table.listingId),
    index("expedion_quote_carrier_idx").on(table.assignedCarrierId),
    // Drives the auto-escalate cron sweep.
    index("expedion_quote_escalate_idx").on(table.escalateAfter),
  ]
);

// ========================================
// Status feed
// ========================================
// One append-only feed both apps read, so the Expedion tracking screen and the
// Expeditoo shipment view never disagree about what happened when.

export const expedionQuoteEvents = pgTable(
  "expedion_quote_events",
  {
    id: text("id").primaryKey(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => expedionQuotes.id, { onDelete: "cascade" }),
    status: expedionQuoteStatusEnum("status").notNull(),
    /** Client-facing line, already in French. */
    message: text("message"),
    /** `client` | `admin` | `driver` | `system` | `expeditoo`. */
    actor: text("actor").default("system").notNull(),
    actorId: text("actor_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("expedion_event_quote_idx").on(table.quoteId, table.createdAt),
  ]
);

// ========================================
// Relations
// ========================================

export const expedionQuotesRelations = relations(
  expedionQuotes,
  ({ one, many }) => ({
    user: one(user, {
      fields: [expedionQuotes.userId],
      references: [user.id],
    }),
    assignedCarrier: one(carriers, {
      fields: [expedionQuotes.assignedCarrierId],
      references: [carriers.id],
    }),
    listing: one(listings, {
      fields: [expedionQuotes.listingId],
      references: [listings.id],
    }),
    events: many(expedionQuoteEvents),
  })
);

export const expedionQuoteEventsRelations = relations(
  expedionQuoteEvents,
  ({ one }) => ({
    quote: one(expedionQuotes, {
      fields: [expedionQuoteEvents.quoteId],
      references: [expedionQuotes.id],
    }),
  })
);

// ========================================
// Type Exports
// ========================================

export type ExpedionQuote = typeof expedionQuotes.$inferSelect;
export type InsertExpedionQuote = typeof expedionQuotes.$inferInsert;
export type ExpedionQuoteEvent = typeof expedionQuoteEvents.$inferSelect;
export type InsertExpedionQuoteEvent = typeof expedionQuoteEvents.$inferInsert;

export type ExpedionQuoteStatus =
  (typeof expedionQuoteStatusEnum.enumValues)[number];
export type ExpedionPaymentStatus =
  (typeof expedionPaymentStatusEnum.enumValues)[number];
export type ExpedionQuoteKind =
  (typeof expedionQuoteKindEnum.enumValues)[number];
