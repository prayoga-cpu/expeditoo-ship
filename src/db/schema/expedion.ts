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

/**
 * The five deadline columns here — `sale_date`, `assigned_at`, `escalated_at`,
 * `escalate_after`, `storage_free_until` — are `timestamptz`; everything else
 * on this table is a plain `timestamp`.
 *
 * They are the ones written from JS *and* compared against SQL `now()`
 * (`ESCALATION_DUE` and `storageAtRisk` in `expedion-report.dal.ts`), and the
 * two do not agree on a naked `timestamp`: Drizzle sends a `Date` as its UTC
 * wall-clock, while `now()` is evaluated in the session's time zone. On a
 * server at UTC+8 that made every quote escalation-due eight hours early —
 * and `findDueForEscalation`, which compares against a JS `Date` instead of
 * `now()`, stayed correct, so the cron and the dashboard disagreed about the
 * same row. `timestamptz` removes the ambiguity rather than asking every
 * call site to remember it.
 *
 * `created_at` / `updated_at` / `requested_at` stay plain: they are written by
 * `defaultNow()` and only ever read for display.
 */
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
    saleDate: timestamp("sale_date", { withTimezone: true }),

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
    assignedAt: timestamp("assigned_at", { withTimezone: true }),

    // ---- Escalation bridge to Expeditoo (Phase D) ----
    /** The marketplace listing this quote became, once escalated. */
    listingId: text("listing_id").references(() => listings.id, {
      onDelete: "set null",
    }),
    escalatedAt: timestamp("escalated_at", { withTimezone: true }),
    /**
     * Whether this job reached its driver from the pool rather than by auction.
     *
     * Direct assignment is modelled as an escalation with a pre-selected winner
     * — it creates a real listing so the shipment, the hold and the write-back
     * are the marketplace's own — which means `listing_id is not null` no
     * longer distinguishes "went out to tender" from "an operator picked
     * someone". Without this column the funnel counted every direct assignment
     * as an escalation and pinned the escalation rate at 100 %.
     */
    assignedDirectly: boolean("assigned_directly").default(false).notNull(),
    /**
     * When the auto-escalate timer fires. Set on `paid`; an admin can force
     * escalation early, which just escalates now and ignores this.
     *
     * `withTimezone`, like the four other deadlines on this table
     * (`sale_date`, `assigned_at`, `escalated_at`, `storage_free_until`) — see
     * the note at the top of the table.
     */
    escalateAfter: timestamp("escalate_after", { withTimezone: true }),

    // ---- Storage countdown (the conversion lever, ROADMAP.md §1) ----
    /**
     * Auction houses charge gardiennage after a grace period — Accord Enchères
     * bills €1–20/day after day ten. Surfacing the countdown is what converts.
     */
    storageFreeUntil: timestamp("storage_free_until", { withTimezone: true }),
    storageDailyFeeCents: integer("storage_daily_fee_cents"),

    // ---- AI extraction (Phase B) ----
    /** Raw model output, kept so a bad extraction can be audited. */
    extraction: jsonb("extraction"),
    extractionModel: text("extraction_model"),
    extractionConfidence: doublePrecision("extraction_confidence"),
    /** Set when the client signs off the confirm-details screen. */
    extractionConfirmedAt: timestamp("extraction_confirmed_at"),

    // ---- AI price suggestion (client-visible) ----
    /**
     * `expedionPriceSuggestionService.suggest`'s output, cached the first
     * time a client opens the AI estimate on a still-pending quote so
     * reopening it does not re-run GPT-4.1 vision. No TTL — same permanence
     * as `extraction` above: holds until `updateQuote` clears it because a
     * pricing-relevant field changed, or the quote gets a real price and the
     * suggestion becomes moot.
     */
    aiSuggestedStandardCents: integer("ai_suggested_standard_cents"),
    aiSuggestedInsuredCents: integer("ai_suggested_insured_cents"),
    aiSuggestionReasoning: text("ai_suggestion_reasoning"),
    aiSuggestionEstimations: jsonb("ai_suggestion_estimations").$type<string[]>(),
    aiSuggestionConfidence: doublePrecision("ai_suggestion_confidence"),
    /** `'ai' | 'engine'` — mirrors `PriceSuggestion['source']`. */
    aiSuggestionSource: text("ai_suggestion_source"),
    aiSuggestedAt: timestamp("ai_suggested_at"),

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
// Uploaded documents
// ========================================
//
// Bordereaux and lot photos used to live in Firebase Storage under
// `users/<uid>/uploads/…`, protected by a rule matching `request.auth.uid`
// against that path segment. Once Expedion moved onto Better Auth there was no
// `request.auth` any more, so every upload by a post-migration account was
// denied and the bordereau form — which will not submit without a document URL
// — stopped working entirely.
//
// The replacement writes the bytes to a private R2 bucket and records the
// object key here. Nothing in `expedion_quotes` ever holds the key: the quote
// stores `/api/expedion/files/<id>`, and this row is the indirection that turns
// that id back into a key *after* the reader has been authorised. That is the
// whole point of the table — a key in the column would be a bearer token for
// the object the moment anything presigned it, which is the Firebase
// `?token=…` leak all over again.
//
// The row is written before the quote exists (the client uploads at pick time,
// on a form it may still abandon), so `quoteId` is nullable and is not what
// authorises a read; `ownerUserId` is. It carries the same value as
// `expedion_quotes.firebase_uid` — the caller's Better Auth user id — so
// "owner of the file" and "owner of the quote" are comparable identifiers.

export const expedionFiles = pgTable(
  "expedion_files",
  {
    id: text("id").primaryKey(),

    /**
     * Who uploaded it, and the only thing a read is authorised against
     * (admins excepted). Deliberately not a foreign key to `user`: the legacy
     * shared-key path can name a Firebase UID that has no row there, and a
     * dangling reference must not stop a document being stored.
     */
    ownerUserId: text("owner_user_id").notNull(),

    /**
     * Set once the quote it belongs to is filed, if ever. `set null` rather
     * than `cascade`: deleting a quote should not silently orphan an object in
     * R2 that nothing will ever clean up.
     */
    quoteId: text("quote_id").references(() => expedionQuotes.id, {
      onDelete: "set null",
    }),

    /** `bordereau` | `photo`. */
    kind: text("kind").notNull(),

    /** Key inside the private Expedion bucket. Never leaves the server. */
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("expedion_file_owner_idx").on(table.ownerUserId),
    index("expedion_file_quote_idx").on(table.quoteId),
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
    files: many(expedionFiles),
  })
);

export const expedionFilesRelations = relations(expedionFiles, ({ one }) => ({
  quote: one(expedionQuotes, {
    fields: [expedionFiles.quoteId],
    references: [expedionQuotes.id],
  }),
}));

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
export type ExpedionFile = typeof expedionFiles.$inferSelect;
export type InsertExpedionFile = typeof expedionFiles.$inferInsert;

export type ExpedionQuoteStatus =
  (typeof expedionQuoteStatusEnum.enumValues)[number];
export type ExpedionPaymentStatus =
  (typeof expedionPaymentStatusEnum.enumValues)[number];
export type ExpedionQuoteKind =
  (typeof expedionQuoteKindEnum.enumValues)[number];
