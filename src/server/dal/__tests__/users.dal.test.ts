import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

import { db } from "@/db";
import { userRoleEnum } from "@/db/schema";
import { assignDefaultRole } from "../users.dal";

describe("usersDAL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("assignDefaultRole", () => {
    it("inserts the 'shipper' role, which the user_role enum contains", async () => {
      // userHasRole's count query: the user holds no roles yet
      vi.mocked(db.select).mockReturnValue({
        from: () => ({ where: async () => [{ count: 0 }] }),
      } as never);

      const inserted: Record<string, unknown>[] = [];
      vi.mocked(db.insert).mockReturnValue({
        values: (row: Record<string, unknown>) => {
          inserted.push(row);
          return { returning: async () => [row] };
        },
      } as never);

      const row = await assignDefaultRole("user-1");

      expect(inserted).toHaveLength(1);
      expect(inserted[0]).toMatchObject({ userId: "user-1", role: "shipper" });
      // The v1 default was "buyer", which the pg enum rejects at runtime —
      // guard against any future default that the enum does not contain.
      expect(userRoleEnum.enumValues).toContain(inserted[0].role);
      expect(row).toMatchObject({ role: "shipper" });
    });
  });
});
