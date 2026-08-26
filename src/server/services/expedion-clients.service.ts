import { z } from "zod";

import {
  expedionClientsDal,
  type ExpedionClientRow,
} from "@/server/dal/expedion-clients.dal";
import { userHasRole } from "@/server/dal/users.dal";

// ========================================
// Errors
// ========================================

export class ExpedionClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "ExpedionClientError";
  }
}

const err = (code: string, status: number, message?: string) =>
  new ExpedionClientError(code, status, message);

// ========================================
// Input
// ========================================

export const listExpedionClientsSchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  linked: z.enum(["all", "withAccount", "withoutAccount"]).default("all"),
  sortBy: z.enum(["lastSeen", "quotes", "value", "name"]).default("lastSeen"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListExpedionClientsInput = z.input<typeof listExpedionClientsSchema>;

// ========================================
// Output
// ========================================

export interface ExpedionClientDto {
  ownerId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  quoteCount: number;
  paidCount: number;
  deliveredCount: number;
  paidValueCents: number;
  firstSeenAt: string;
  lastSeenAt: string;
  /** The Expeditoo account behind this client, when there is one. */
  account: {
    id: string;
    name: string | null;
    email: string;
    banned: boolean;
  } | null;
}

export interface ExpedionClientQuoteDto {
  id: string;
  quoteNumber: string | null;
  bordereauNumber: string | null;
  status: string;
  paymentStatus: string;
  acceptedPriceCents: number | null;
  pickupCity: string | null;
  deliveryCity: string | null;
  /** Set once the quote became a marketplace job. */
  listingId: string | null;
  createdAt: string;
}

/**
 * Admin only, refused here rather than in the route (docs/rules.md §3.4).
 *
 * Same guard as the Expedion report: this reads every client on the platform
 * and must never be reachable by an Expedion *client* credential, which is
 * what `/api/expedion/*` authorises.
 */
async function requireAdmin(actorUserId: string) {
  if (!(await userHasRole(actorUserId, "admin"))) {
    throw err("FORBIDDEN", 403, "Admin access required");
  }
}

export const expedionClientsService = {
  /**
   * Expedion's client book.
   *
   * The list exists because `/admin/users` structurally cannot show these
   * people: they are quote owners, and the overwhelming majority have no `user`
   * row to list. See docs/specs/admin_expedion_clients_spec.md §1.
   */
  async list(actorUserId: string, query: unknown) {
    await requireAdmin(actorUserId);

    const filters = listExpedionClientsSchema.parse(query);

    // Both halves of the page in one round trip. The count is a separate
    // statement because the list is windowed and its row count is the page
    // size, not the total.
    const [rows, total] = await Promise.all([
      expedionClientsDal.list(filters),
      expedionClientsDal.count(filters),
    ]);

    return {
      clients: rows.map(toDto),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    };
  },

  /** One client, with the quotes they have filed. */
  async getOne(actorUserId: string, ownerId: string) {
    await requireAdmin(actorUserId);

    const row = await expedionClientsDal.getOne(ownerId);
    if (!row) throw err("CLIENT_NOT_FOUND", 404);

    const quotes = await expedionClientsDal.quotesFor(ownerId);

    return {
      client: toDto(row),
      quotes: quotes.map(
        (q): ExpedionClientQuoteDto => ({
          id: q.id,
          quoteNumber: q.quoteNumber,
          bordereauNumber: q.bordereauNumber,
          status: q.status,
          paymentStatus: q.paymentStatus,
          acceptedPriceCents: q.acceptedPriceCents,
          pickupCity: q.pickupCity,
          deliveryCity: q.deliveryCity,
          listingId: q.listingId,
          createdAt: q.createdAt.toISOString(),
        })
      ),
    };
  },
};

/**
 * Joins the two name parts once, here, so the table and the dialog cannot
 * disagree about a client with only a surname. Null rather than an empty
 * string when the client gave neither — the UI has a placeholder for absent,
 * and `""` would render as a blank cell that looks like a bug.
 */
function toDto(row: ExpedionClientRow): ExpedionClientDto {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();

  return {
    ownerId: row.ownerId,
    name: name || null,
    email: row.email,
    phone: row.phone,
    city: row.city,
    quoteCount: row.quoteCount,
    paidCount: row.paidCount,
    deliveredCount: row.deliveredCount,
    paidValueCents: row.paidValueCents,
    firstSeenAt: new Date(row.firstSeenAt).toISOString(),
    lastSeenAt: new Date(row.lastSeenAt).toISOString(),
    account: row.accountUserId
      ? {
          id: row.accountUserId,
          name: row.accountName,
          email: row.accountEmail ?? "",
          banned: row.accountBanned ?? false,
        }
      : null,
  };
}
