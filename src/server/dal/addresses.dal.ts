import { db } from "@/db";
import { addresses, type InsertAddress } from "@/db/schema/addresses";
import { eq, and, desc } from "drizzle-orm";

export const addressesDal = {
  /**
   * Create a new address
   */
  async create(data: InsertAddress) {
    const [result] = await db.insert(addresses).values(data).returning();
    return result;
  },

  /**
   * Get address by ID
   */
  async getById(id: string) {
    return await db.query.addresses.findFirst({
      where: eq(addresses.id, id),
    });
  },

  /**
   * Get all addresses for a user
   */
  async getByUserId(userId: string) {
    return await db.query.addresses.findMany({
      where: eq(addresses.userId, userId),
      orderBy: [desc(addresses.isDefault), desc(addresses.createdAt)],
    });
  },

  /**
   * Get default address for a user
   */
  async getDefaultByUserId(userId: string) {
    return await db.query.addresses.findFirst({
      where: and(eq(addresses.userId, userId), eq(addresses.isDefault, true)),
    });
  },

  /**
   * Update an address
   */
  async update(id: string, data: Partial<InsertAddress>) {
    const [result] = await db
      .update(addresses)
      .set(data)
      .where(eq(addresses.id, id))
      .returning();
    return result;
  },

  /**
   * Delete an address
   */
  async delete(id: string) {
    const [result] = await db
      .delete(addresses)
      .where(eq(addresses.id, id))
      .returning();
    return result;
  },

  /**
   * Get address owner (for authorization check)
   */
  async getOwner(id: string) {
    const address = await db.query.addresses.findFirst({
      where: eq(addresses.id, id),
      columns: { userId: true },
    });
    return address?.userId || null;
  },

  /**
   * Clear default flag for all user addresses
   */
  async clearDefaultForUser(userId: string) {
    await db
      .update(addresses)
      .set({ isDefault: false })
      .where(eq(addresses.userId, userId));
  },

  /**
   * Set address as default
   */
  async setAsDefault(id: string, userId: string) {
    // First, clear all defaults for this user
    await this.clearDefaultForUser(userId);

    // Then set the specified address as default
    const [result] = await db
      .update(addresses)
      .set({ isDefault: true })
      .where(eq(addresses.id, id))
      .returning();
    return result;
  },
};
