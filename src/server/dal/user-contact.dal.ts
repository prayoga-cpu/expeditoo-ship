import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema/users";
import { userContactDetails } from "@/db/schema/user-contact-details";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The name parts on `user` and the phones in `user_contact_details`. */
export const userContactDal = {
  /** One account's names and phones; undefined when the account is gone. */
  async get(userId: string, tx: Executor = db) {
    const [row] = await tx
      .select({
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        alias: user.alias,
        phone: userContactDetails.phone,
        relativeName: userContactDetails.relativeName,
        relativePhone: userContactDetails.relativePhone,
      })
      .from(user)
      .leftJoin(userContactDetails, eq(userContactDetails.userId, user.id))
      .where(eq(user.id, userId));
    return row;
  },

  async updateNames(
    userId: string,
    data: Partial<Pick<typeof user.$inferInsert, "name" | "firstName" | "lastName" | "alias">>,
    tx: Executor = db
  ) {
    await tx.update(user).set(data).where(eq(user.id, userId));
  },

  /** One row per account, created on the first save. */
  async upsertDetails(
    userId: string,
    data: Partial<Pick<typeof userContactDetails.$inferInsert, "phone" | "relativeName" | "relativePhone">>,
    tx: Executor = db
  ) {
    await tx
      .insert(userContactDetails)
      .values({ userId, ...data })
      .onConflictDoUpdate({
        target: userContactDetails.userId,
        set: { ...data, updatedAt: new Date() },
      });
  },
};
