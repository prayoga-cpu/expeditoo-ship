import { db } from "@/db";
import { platformSettings } from "@/db/schema/platform-settings";
import { eq } from "drizzle-orm";

const SETTINGS_ID = "default";

export const platformSettingsDal = {
  async get() {
    return db.query.platformSettings.findFirst({
      where: eq(platformSettings.id, SETTINGS_ID),
    });
  },

  async upsert(data: { feeBasisPoints: number; updatedBy: string }) {
    const [row] = await db
      .insert(platformSettings)
      .values({
        id: SETTINGS_ID,
        feeBasisPoints: data.feeBasisPoints,
        updatedBy: data.updatedBy,
      })
      .onConflictDoUpdate({
        target: platformSettings.id,
        set: {
          feeBasisPoints: data.feeBasisPoints,
          updatedBy: data.updatedBy,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  },
};
