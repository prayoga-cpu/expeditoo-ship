import { db } from "@/db";
import { driverApplications, InsertDriverApplication } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const driverApplicationDal = {
  create: async (data: InsertDriverApplication) => {
    const [result] = await db
      .insert(driverApplications)
      .values(data)
      .returning();
    return result;
  },

  getByUserId: async (userId: string) => {
    const result = await db.query.driverApplications.findFirst({
      where: eq(driverApplications.userId, userId),
    });
    return result;
  },

  getById: async (id: string) => {
    const result = await db.query.driverApplications.findFirst({
      where: eq(driverApplications.id, id),
      with: {
        user: true,
      },
    });
    return result;
  },

  getAll: async () => {
    const result = await db.query.driverApplications.findMany({
      orderBy: [desc(driverApplications.createdAt)],
      with: {
        user: true,
      },
    });
    return result;
  },

  updateStatus: async (
    id: string,
    status: "APPROVED" | "REJECTED" | "PENDING"
  ) => {
    const [result] = await db
      .update(driverApplications)
      .set({ status })
      .where(eq(driverApplications.id, id))
      .returning();
    return result;
  },
};
