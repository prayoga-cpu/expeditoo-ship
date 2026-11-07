import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * The flat « Bordereaux » view: one row per quote that has a slip — by number,
 * by document, or by a file filed with it — with the buyer's contact beside it.
 * Staff only; the service above enforces that.
 *
 * Raw SQL because it needs a correlated count of the filed documents, and the
 * column list is the one the client's Airtable table showed.
 */
export type BordereauRow = {
  id: string;
  reference: number | null;
  quoteNumber: string | null;
  bordereauNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  clientAddress: string | null;
  clientPostalCode: string | null;
  clientCity: string | null;
  auctionHouseName: string | null;
  saleDate: string | null;
  description: string | null;
  bordereauDocUrl: string | null;
  documentCount: number;
  status: string;
};

const HAS_SLIP = sql`(
  q.bordereau_number is not null
  or q.bordereau_doc_url is not null
  or exists (select 1 from expedion_files f where f.quote_id = q.id)
)`;

function matching(search: string | undefined) {
  if (!search) return sql`true`;
  // `%`/`_` typed by a person are literals, not wildcards.
  const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return sql`(
    coalesce(q.bordereau_number, '') ilike ${like}
    or coalesce(q.quote_number, '') ilike ${like}
    or coalesce(q.first_name, '') || ' ' || coalesce(q.last_name, '') ilike ${like}
    or coalesce(q.email, '') ilike ${like}
    or coalesce(q.phone, '') ilike ${like}
    or coalesce(q.client_city, '') ilike ${like}
    or coalesce(q.auction_house_name, '') ilike ${like}
    or coalesce(q.description, '') ilike ${like}
  )`;
}

const COLUMNS = sql`
  q.id,
  q.reference,
  q.quote_number as "quoteNumber",
  q.bordereau_number as "bordereauNumber",
  q.first_name as "firstName",
  q.last_name as "lastName",
  q.email,
  q.phone,
  q.client_address as "clientAddress",
  q.client_postal_code as "clientPostalCode",
  q.client_city as "clientCity",
  q.auction_house_name as "auctionHouseName",
  to_char(q.sale_date, 'YYYY-MM-DD') as "saleDate",
  q.description,
  q.bordereau_doc_url as "bordereauDocUrl",
  (select count(*)::int from expedion_files f where f.quote_id = q.id) as "documentCount",
  q.status::text as status
`;

export const expedionBordereauxDal = {
  async page(params: { search?: string; limit: number; offset: number }) {
    const where = matching(params.search);
    const [rows, totals] = await Promise.all([
      db.execute<BordereauRow>(sql`
        select ${COLUMNS}
        from expedion_quotes q
        where ${HAS_SLIP} and ${where}
        order by q.sale_date desc nulls last, q.requested_at desc nulls last, q.id
        limit ${params.limit} offset ${params.offset}
      `),
      db.execute<{ total: number }>(sql`
        select count(*)::int as total from expedion_quotes q where ${HAS_SLIP} and ${where}
      `),
    ]);
    return { rows: [...rows], total: Number([...totals][0]?.total ?? 0) };
  },

  /** Everything the same search matches, capped, for the CSV. */
  async all(params: { search?: string; cap: number }) {
    const rows = await db.execute<BordereauRow>(sql`
      select ${COLUMNS}
      from expedion_quotes q
      where ${HAS_SLIP} and ${matching(params.search)}
      order by q.sale_date desc nulls last, q.requested_at desc nulls last, q.id
      limit ${params.cap}
    `);
    return [...rows];
  },
};
