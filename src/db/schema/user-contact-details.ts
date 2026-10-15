import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./users";

/**
 * A person's own phone, and the name and phone of someone close to them
 * (client_feedback_2026_10_spec.md §7b).
 *
 * Its own table rather than columns on `user`, on purpose: the DAL loads whole
 * `user` rows beside listings, offers, shipments, payments and invoices, and a
 * relative's number is a third party's personal data that no counterpart needs.
 * Kept out of `user`, no existing join can carry it. There is deliberately no
 * relation declared from `user` either, so `with: { … }` cannot reach it — it
 * is read by `userContactService`, for the owner and for staff, and nowhere else.
 */
export const userContactDetails = pgTable("user_contact_details", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  phone: text("phone"),
  relativeName: text("relative_name"),
  relativePhone: text("relative_phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type UserContactDetails = typeof userContactDetails.$inferSelect;
export type InsertUserContactDetails = typeof userContactDetails.$inferInsert;
