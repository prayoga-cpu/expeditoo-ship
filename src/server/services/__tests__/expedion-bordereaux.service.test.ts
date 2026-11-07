import { beforeEach, describe, expect, it, vi } from "vitest";

const page = vi.fn();
const all = vi.fn();
vi.mock("@/server/dal/expedion-bordereaux.dal", () => ({
  expedionBordereauxDal: { page: (...a: unknown[]) => page(...a), all: (...a: unknown[]) => all(...a) },
}));
vi.mock("@/server/services/admin.service", () => ({
  AdminError: class extends Error {
    constructor(public code: string, message: string, public status: number) {
      super(message);
    }
  },
}));

import {
  bordereauxQuerySchema,
  exportBordereauxCsv,
  listBordereaux,
} from "../expedion-bordereaux.service";

const staff = { isAdmin: true, isOperator: false } as never;
const client = { isAdmin: false, isOperator: false } as never;

beforeEach(() => {
  page.mockReset().mockResolvedValue({ rows: [], total: 0 });
  all.mockReset();
});

describe("the flat bordereaux table", () => {
  it("refuses anyone who is not staff, for the page and for the CSV", async () => {
    const query = bordereauxQuerySchema.parse({});
    await expect(listBordereaux(client, query)).rejects.toMatchObject({ status: 403 });
    await expect(exportBordereauxCsv(client)).rejects.toMatchObject({ status: 403 });
    expect(page).not.toHaveBeenCalled();
    expect(all).not.toHaveBeenCalled();
  });

  it("pages from the requested page", async () => {
    await listBordereaux(staff, bordereauxQuerySchema.parse({ page: "3", limit: "25", q: "dupont" }));
    expect(page).toHaveBeenCalledWith({ search: "dupont", limit: 25, offset: 50 });
  });

  it("exports the rows as a CSV with the French header", async () => {
    all.mockResolvedValue([
      {
        bordereauNumber: "B-12",
        quoteNumber: null,
        firstName: "Marie",
        lastName: "Dupont",
        email: "m@x.fr",
        phone: "=1+1",
        clientAddress: "1 rue A",
        clientPostalCode: "75009",
        clientCity: "Paris",
        auctionHouseName: null,
        saleDate: "2026-10-01",
        description: "Commode",
        documentCount: 2,
        status: "paid",
      },
    ]);
    const csv = await exportBordereauxCsv(staff);
    expect(csv).toContain("N° bordereau;N° devis;Prénom");
    expect(csv).toContain("B-12;;Marie;Dupont;m@x.fr;'=1+1;");
  });
});
