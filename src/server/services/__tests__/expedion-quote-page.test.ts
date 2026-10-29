import { beforeEach, describe, expect, it, vi } from "vitest";

const dal = vi.hoisted(() => ({ getQuotePage: vi.fn() }));
vi.mock("@/server/dal/expedion-report.dal", () => dal);
vi.mock("@/server/dal/admin.dal", () => ({}));

import {
  listQuotePage,
  quotePageQuerySchema,
} from "../expedion-report.service";

/** client_feedback_2026_10_29_spec.md §A2 */
describe("listQuotePage", () => {
  beforeEach(() => {
    dal.getQuotePage.mockReset();
    dal.getQuotePage.mockResolvedValue({ rows: [], total: 0 });
  });

  it("answers staff only", async () => {
    await expect(
      listQuotePage({ userId: "u1" }, quotePageQuerySchema.parse({}))
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(dal.getQuotePage).not.toHaveBeenCalled();
  });

  it("passes the window, the order and the offset through", async () => {
    const query = quotePageQuerySchema.parse({
      from: "2026-10-02T22:00:00.000Z",
      to: "2026-10-05T22:00:00.000Z",
      order: "asc",
      page: "3",
      limit: "50",
    });
    const page = await listQuotePage({ userId: "op", isOperator: true }, query);

    expect(dal.getQuotePage).toHaveBeenCalledWith({
      from: new Date("2026-10-02T22:00:00.000Z"),
      to: new Date("2026-10-05T22:00:00.000Z"),
      order: "asc",
      limit: 50,
      offset: 100,
    });
    expect(page).toMatchObject({ page: 3, limit: 50, total: 0 });
  });

  it("opens newest first, 25 at a time, with no window", () => {
    expect(quotePageQuerySchema.parse({})).toEqual({ order: "desc", page: 1, limit: 25 });
  });

  it("refuses a window that ends before it starts, and a page too large", () => {
    expect(() =>
      quotePageQuerySchema.parse({
        from: "2026-10-05T00:00:00.000Z",
        to: "2026-10-01T00:00:00.000Z",
      })
    ).toThrow();
    expect(() => quotePageQuerySchema.parse({ limit: "500" })).toThrow();
  });
});
