import { z } from "zod";
import { toCsv } from "@/lib/csv";
import { expedionBordereauxDal } from "@/server/dal/expedion-bordereaux.dal";
import { AdminError } from "@/server/services/admin.service";
import type { Viewer } from "@/server/services/shipment-access";

export const bordereauxQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type BordereauxQuery = z.infer<typeof bordereauxQuerySchema>;

/** A CSV beyond this is a data export, not a table's worth of rows. */
const EXPORT_CAP = 20_000;

function assertStaff(viewer: Viewer) {
  if (!viewer.isAdmin && !viewer.isOperator) {
    throw new AdminError("FORBIDDEN", "Staff access required", 403);
  }
}

export async function listBordereaux(viewer: Viewer, query: BordereauxQuery) {
  assertStaff(viewer);
  const { rows, total } = await expedionBordereauxDal.page({
    search: query.q || undefined,
    limit: query.limit,
    offset: (query.page - 1) * query.limit,
  });
  return { rows, total, page: query.page, limit: query.limit };
}

const HEADER = [
  "N° bordereau",
  "N° devis",
  "Prénom",
  "Nom",
  "E-mail",
  "Téléphone",
  "Adresse de facturation",
  "Code postal",
  "Ville",
  "Maison de ventes",
  "Date de vente",
  "Description",
  "Documents",
  "Statut",
];

export async function exportBordereauxCsv(viewer: Viewer, search?: string) {
  assertStaff(viewer);
  const rows = await expedionBordereauxDal.all({ search: search || undefined, cap: EXPORT_CAP });
  return toCsv(
    HEADER,
    rows.map((r) => [
      r.bordereauNumber,
      r.quoteNumber,
      r.firstName,
      r.lastName,
      r.email,
      r.phone,
      r.clientAddress,
      r.clientPostalCode,
      r.clientCity,
      r.auctionHouseName,
      r.saleDate,
      r.description,
      r.documentCount,
      r.status,
    ])
  );
}
