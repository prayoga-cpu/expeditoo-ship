import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  companyIdentity,
  type InsertCompanyIdentity,
} from "@/db/schema/company-identity";

const IDENTITY_ID = "default";

export type CompanyIdentityFields = Omit<
  InsertCompanyIdentity,
  "id" | "createdAt" | "updatedAt"
>;

export const companyIdentityDal = {
  async get() {
    return db.query.companyIdentity.findFirst({
      where: eq(companyIdentity.id, IDENTITY_ID),
    });
  },

  /** Writes every field it is given — a null clears that column. */
  async upsert(fields: CompanyIdentityFields) {
    const [row] = await db
      .insert(companyIdentity)
      .values({ id: IDENTITY_ID, ...fields })
      .onConflictDoUpdate({
        target: companyIdentity.id,
        set: { ...fields, updatedAt: new Date() },
      })
      .returning();
    return row;
  },
};
