/**
 * The data `seed-beta-data.ts` writes, kept apart from the writing.
 *
 * Nothing here touches a database or an environment variable, so it can be
 * unit-tested and read on its own. Every fixture that a service will consume
 * is run through that service's own Zod schema first — the seed then feeds the
 * services exactly what the API would, defaults included, rather than a
 * hand-built object that happens to look right today.
 */

import type { InsertCarrier, InsertVehicle } from "@/db/schema/carriers";
import type { InsertExpedionQuote } from "@/db/schema/expedion";
import type { InsertListing } from "@/db/schema/listings";
import type { InsertShipmentPhoto } from "@/db/schema/shipments";
import {
  createCarrierRouteSchema,
  type CreateCarrierRouteInput,
} from "@/server/dto/carrier-routes.dto";
import {
  createListingSchema,
  type CreateListingInput,
} from "@/server/dto/listings.dto";
import { createOfferSchema, type CreateOfferInput } from "@/server/dto/offers.dto";

/** Every seeded title starts with this, so a tester knows what they are looking at. */
export const TITLE_PREFIX = "BETA · ";

/** Fixed ids: a second run repairs rather than duplicates. */
export const IDS = {
  ownerCarrier: "beta_carrier_owner",
  qaCarrier: "beta_carrier_qa",
  ownerVehicle: "beta_vehicle_owner",
  qaVehicle: "beta_vehicle_qa",
  expedionQuote: "beta_expedion_quote_001",
  expedionClientUid: "beta-expedion-client",
} as const;

/**
 * Syntactically valid, unregistered SIRETs — the column is unique and the
 * form's own validator applies Luhn, so these have to pass it without
 * belonging to a real business.
 */
export const OWNER_SIRET = "84212345600019";
export const QA_SIRET = "84298765400014";

/** Luhn over 14 digits, doubling the odd positions counted from the left. */
export function isValidSiret(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) return false;
  const sum = [...siret].reduce((total, char, index) => {
    const digit = Number(char);
    if (index % 2 !== 0) return total + digit;
    const doubled = digit * 2;
    return total + (doubled > 9 ? doubled - 9 : doubled);
  }, 0);
  return sum % 10 === 0;
}

const DAY_MS = 86_400_000;

/** A UTC instant `days` from today at `hourUtc` — 07:00Z is 09:00 in Paris in summer. */
export function utcAt(days: number, hourUtc: number, now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days, hourUtc)
  );
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysAgo(now: Date, days: number, hourUtc: number): Date {
  const day = new Date(now.getTime() - days * DAY_MS);
  return new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hourUtc)
  );
}

export interface Place {
  address: string;
  city: string;
  postalCode: string;
  lat: number;
  lng: number;
  locationType: "house" | "warehouse" | "shop" | "office";
}

/** Real streets, all inside France, all more than 500 m apart. */
export const PLACES = {
  drouot: {
    address: "9 Rue Drouot",
    city: "Paris",
    postalCode: "75009",
    lat: 48.8734,
    lng: 2.3405,
    locationType: "shop",
  },
  lyon: {
    address: "24 Rue de la République",
    city: "Lyon",
    postalCode: "69002",
    lat: 45.764,
    lng: 4.8357,
    locationType: "house",
  },
  marseille: {
    address: "12 Quai du Port",
    city: "Marseille",
    postalCode: "13002",
    lat: 43.2965,
    lng: 5.3698,
    locationType: "house",
  },
  bordeaux: {
    address: "18 Rue Notre-Dame",
    city: "Bordeaux",
    postalCode: "33000",
    lat: 44.8533,
    lng: -0.5705,
    locationType: "house",
  },
  lille: {
    address: "5 Rue de la Monnaie",
    city: "Lille",
    postalCode: "59000",
    lat: 50.6413,
    lng: 3.0625,
    locationType: "shop",
  },
  nantes: {
    address: "3 Rue Crébillon",
    city: "Nantes",
    postalCode: "44000",
    lat: 47.2135,
    lng: -1.5606,
    locationType: "house",
  },
} as const satisfies Record<string, Place>;

export interface ListingSpec {
  title: string;
  description: string;
  weightKg: number;
  budgetCents: number;
  from: Place;
  to: Place;
  /** Days from today the pickup window opens (09:00–12:00 Paris). */
  pickupDay: number;
  publish: boolean;
}

/** The six jobs, one per screen a tester should find something on. */
export const LISTINGS = {
  completed: {
    title: "Commode Louis-Philippe en noyer, lot 42 — Paris → Lyon",
    description:
      "Commode trois tiroirs, dessus marbre, achetée en salle des ventes. À " +
      "manipuler à deux, couverture de déménagement fournie sur place.",
    weightKg: 45,
    budgetCents: 24_900,
    from: PLACES.drouot,
    to: PLACES.lyon,
    pickupDay: 3,
    publish: true,
  },
  driverRun: {
    title: "Miroir vénitien, lot 17 — Paris → Bordeaux",
    description:
      "Miroir de 140 × 90 cm, cadre en verre gravé. Emballé bulle et carton " +
      "plat, à transporter debout, jamais à plat.",
    weightKg: 30,
    budgetCents: 19_900,
    from: PLACES.drouot,
    to: PLACES.bordeaux,
    pickupDay: 4,
    publish: true,
  },
  shipperRun: {
    title: "Bureau plat en acajou — Lyon → Marseille",
    description:
      "Bureau plat XIXe, pieds démontables (visserie fournie dans un sachet " +
      "scotché sous le plateau). Rez-de-chaussée des deux côtés.",
    weightKg: 60,
    budgetCents: 22_000,
    from: PLACES.lyon,
    to: PLACES.marseille,
    pickupDay: 5,
    publish: true,
  },
  awaitingChoice: {
    title: "Tableau encadré 120 × 90 — Lille → Paris",
    description:
      "Huile sur toile dans son cadre doré, protégée par des coins mousse et " +
      "un film bulle. Peut voyager à plat entre deux couvertures.",
    weightKg: 12,
    budgetCents: 9_900,
    from: PLACES.lille,
    to: PLACES.drouot,
    pickupDay: 6,
    publish: true,
  },
  draft: {
    title: "Vaisselier deux corps — Nantes → Paris",
    description:
      "Vaisselier en chêne, partie haute et partie basse séparables. Les " +
      "portes vitrées seront retirées et emballées à part avant l'enlèvement.",
    weightKg: 80,
    budgetCents: 30_000,
    from: PLACES.nantes,
    to: PLACES.drouot,
    pickupDay: 8,
    publish: false,
  },
} as const satisfies Record<string, ListingSpec>;

function endpoint(place: Place) {
  return {
    address: place.address,
    city: place.city,
    postalCode: place.postalCode,
    lat: place.lat,
    lng: place.lng,
    locationType: place.locationType,
  };
}

/** What `/create` would have posted, validated by the same schema the route uses. */
export function listingInput(spec: ListingSpec, now = new Date()): CreateListingInput {
  return createListingSchema.parse({
    title: TITLE_PREFIX + spec.title,
    description: spec.description,
    weightKg: spec.weightKg,
    budgetCents: spec.budgetCents,
    isFragile: true,
    pickup: endpoint(spec.from),
    dropoff: endpoint(spec.to),
    pickupFrom: utcAt(spec.pickupDay, 7, now),
    pickupUntil: utcAt(spec.pickupDay, 10, now),
    dropoffFrom: utcAt(spec.pickupDay + 1, 8, now),
    dropoffUntil: utcAt(spec.pickupDay + 3, 18, now),
    publish: spec.publish,
  });
}

/**
 * One morning slot on the job's own pickup day, delivery the next evening.
 * `tzOffset` is `Date#getTimezoneOffset` for Paris in summer.
 */
export function offerInput(
  pickupFrom: Date,
  vehicleId: string,
  priceCents: number,
  message: string
): CreateOfferInput {
  return createOfferSchema.parse({
    vehicleId,
    priceCents,
    slots: [{ day: isoDay(pickupFrom), slot: "morning" }],
    deliveryLeadDays: 1,
    tzOffset: -120,
    message,
  });
}

export function carrierRow(kind: "owner" | "qa", userId: string): InsertCarrier {
  const owner = kind === "owner";
  return {
    id: owner ? IDS.ownerCarrier : IDS.qaCarrier,
    userId,
    companyName: owner ? "Transports Prayoga" : "QA Transport Rhône",
    siret: owner ? OWNER_SIRET : QA_SIRET,
    legalForm: "auto-entrepreneur",
    contactPhone: owner ? "+33612345678" : "+33698765432",
    addressLine: owner ? "9 Rue Drouot" : "24 Rue de la République",
    city: owner ? "Paris" : "Lyon",
    postalCode: owner ? "75009" : "69002",
    status: "submitted",
    ibanLast4: "4242",
    bio: owner
      ? "Transport d'objets d'art et de mobilier de salle des ventes, Île-de-France et grands axes."
      : "Compte transporteur de test — bêta EXPEDITOO.",
  };
}

export function vehicleRow(kind: "owner" | "qa", carrierId: string): InsertVehicle {
  return kind === "owner"
    ? {
        id: IDS.ownerVehicle,
        carrierId,
        type: "van",
        make: "Renault",
        model: "Master L2H2",
        year: 2022,
        plateNumber: "GB-123-PR",
        maxWeightKg: 1200,
        maxLengthCm: 340,
        maxWidthCm: 180,
        maxHeightCm: 190,
      }
    : {
        id: IDS.qaVehicle,
        carrierId,
        type: "truck_20m3",
        make: "Iveco",
        model: "Daily 35S16",
        year: 2021,
        plateNumber: "GC-456-QA",
        maxWeightKg: 2500,
        maxLengthCm: 420,
        maxWidthCm: 200,
        maxHeightCm: 210,
      };
}

export const ROUTE_LABELS = {
  owner: TITLE_PREFIX + "Paris → Lyon, lun / mer / ven",
  qa: TITLE_PREFIX + "Lyon → Marseille, ponctuel",
} as const;

/** A recurring trajet for the owner, an occasional one for the QA carrier. */
export function routeInputs(
  ownerVehicleId: string,
  qaVehicleId: string,
  now = new Date()
): { owner: CreateCarrierRouteInput; qa: CreateCarrierRouteInput } {
  return {
    owner: createCarrierRouteSchema.parse({
      label: ROUTE_LABELS.owner,
      kind: "recurring",
      origin: endpoint(PLACES.drouot),
      destination: endpoint(PLACES.lyon),
      radiusKm: 60,
      daysOfWeek: [1, 3, 5],
      vehicleId: ownerVehicleId,
      capacityKg: 1200,
    }),
    qa: createCarrierRouteSchema.parse({
      label: ROUTE_LABELS.qa,
      kind: "occasional",
      origin: endpoint(PLACES.lyon),
      destination: endpoint(PLACES.marseille),
      radiusKm: 40,
      dates: [utcAt(5, 6, now), utcAt(12, 6, now)],
      vehicleId: qaVehicleId,
      capacityKg: 2500,
    }),
  };
}

/** A paid Expedion quote already escalated to the board — what an operator awards. */
export function expedionQuoteRow(now: Date): InsertExpedionQuote {
  return {
    id: IDS.expedionQuote,
    firebaseUid: IDS.expedionClientUid,
    quoteNumber: "BETA-DEVIS-001",
    bordereauNumber: "BETA-BORD-2026-001",
    firstName: "Camille",
    lastName: "Bêta",
    email: "beta-client@expeditoo.test",
    phone: null,
    description:
      "BETA — Paire de fauteuils Louis XV cannés, lot 63. Devis Expedion " +
      "payé, escaladé sur la place de marché pour attribution.",
    auctionHouseName: "Hôtel Drouot (BETA)",
    pickupAddress: PLACES.drouot.address,
    pickupPostalCode: PLACES.drouot.postalCode,
    pickupCity: PLACES.drouot.city,
    pickupLat: PLACES.drouot.lat,
    pickupLng: PLACES.drouot.lng,
    recipientName: "Camille Bêta",
    deliveryAddress: PLACES.marseille.address,
    deliveryPostalCode: PLACES.marseille.postalCode,
    deliveryCity: PLACES.marseille.city,
    deliveryCountry: "France",
    deliveryLat: PLACES.marseille.lat,
    deliveryLng: PLACES.marseille.lng,
    lengthCm: 95,
    widthCm: 70,
    heightCm: 100,
    weightKg: 38,
    isProtected: true,
    declaredValueCents: 420_000,
    quoteStandardCents: 32_000,
    quoteInsuredCents: 35_500,
    acceptedKind: "standard",
    acceptedPriceCents: 32_000,
    quoteAvailable: true,
    status: "escalated",
    paymentStatus: "paid",
    escalateAfter: new Date(now.getTime() - 60 * 60 * 1000),
    escalatedAt: now,
  };
}

/** The listing that quote became: owned by the system account, origin `expedion`. */
export function expedionListingRow(
  id: string,
  shipperId: string,
  categoryId: string,
  quote: InsertExpedionQuote,
  now: Date
): InsertListing {
  const pickupFrom = utcAt(5, 7, now);
  return {
    id,
    shipperId,
    categoryId,
    status: "open",
    origin: "expedion",
    externalRef: quote.id,
    title: TITLE_PREFIX + "Paire de fauteuils Louis XV, lot 63 — Paris → Marseille",
    description: quote.description ?? "",
    weightKg: quote.weightKg ?? 38,
    lengthCm: quote.lengthCm,
    widthCm: quote.widthCm,
    heightCm: quote.heightCm,
    isFragile: true,
    packagingLevel: "protected",
    pickupLat: PLACES.drouot.lat,
    pickupLng: PLACES.drouot.lng,
    pickupAddress: PLACES.drouot.address,
    pickupCity: PLACES.drouot.city,
    pickupPostalCode: PLACES.drouot.postalCode,
    pickupLocationType: "shop",
    dropoffLat: PLACES.marseille.lat,
    dropoffLng: PLACES.marseille.lng,
    dropoffAddress: PLACES.marseille.address,
    dropoffCity: PLACES.marseille.city,
    dropoffPostalCode: PLACES.marseille.postalCode,
    dropoffLocationType: "house",
    dropoffContactName: quote.recipientName,
    pickupFrom,
    pickupUntil: utcAt(5, 10, now),
    dropoffFrom: utcAt(6, 8, now),
    dropoffUntil: utcAt(8, 18, now),
    budgetCents: quote.acceptedPriceCents ?? 32_000,
    expiresAt: new Date(pickupFrom.getTime() - 6 * 60 * 60 * 1000),
  };
}

/**
 * Satisfies the pickup/delivery photo gate for a seeded run. There is no
 * object behind the key — the row is soft-deleted again right after the
 * transition, so nothing ever tries to render it.
 */
export function placeholderPhoto(
  shipmentId: string,
  stage: "pickup" | "delivery",
  place: Place,
  uploadedByUserId: string,
  capturedAt: Date
): InsertShipmentPhoto {
  return {
    id: `beta_photo_${stage}_${shipmentId}`,
    shipmentId,
    stage,
    objectKey: `beta/placeholder-${stage}.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 1,
    capturedLat: place.lat,
    capturedLng: place.lng,
    capturedAccuracyM: 12,
    capturedAddress: `${place.address}, ${place.postalCode} ${place.city}`,
    capturedAt,
    uploadedByUserId,
  };
}

export const PLACEHOLDER_REMOVAL_REASON =
  "Placeholder from the beta seed — no image object was ever stored.";

export const MESSAGES = {
  fromCarrier:
    "Bonjour, je passe à Drouot vendredi matin. Le bureau est-il déjà démonté, ou faut-il prévoir 20 minutes sur place ?",
  fromShipper:
    "Bonjour, il sera démonté et la visserie dans un sachet sous le plateau. Merci !",
} as const;

export const REVIEWS = {
  byShipper: "Enlèvement à l'heure, commode livrée sans une trace. Je recommande.",
  byCarrier: "Client disponible et précis sur l'accès. Tout s'est bien passé.",
} as const;
