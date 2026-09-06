import { pgTable, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";

/**
 * Where a document's number comes from.
 *
 * Invoice numbers used to be `count(*) + 1` read in one statement and inserted
 * in another, against a UNIQUE column. Two awards in the same second computed
 * the same string and the loser got a 23505; and once any non-highest row was
 * deleted — both foreign keys on `invoices` cascade, and TESTING_MOCKS.md asks
 * for the `pi_mock_` payments to be purged — the count re-derived a number that
 * had already been issued, forever.
 *
 * A counter row is claimed with `ON CONFLICT DO UPDATE ... RETURNING` inside
 * the same transaction as the document it numbers, so the two commit together
 * and the high-water mark survives deletion of the rows it numbered.
 *
 * `series` is the human prefix — `INV` for a facture, `AV` for an avoir — kept
 * apart so a credit note never puts a gap in the invoice series.
 */
export const documentSequences = pgTable(
  "document_sequences",
  {
    series: text("series").notNull(),
    year: integer("year").notNull(),
    lastValue: integer("last_value").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.series, table.year], name: "document_sequences_pk" }),
  ]
);

export type DocumentSequence = typeof documentSequences.$inferSelect;
