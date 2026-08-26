import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/dal/expedion-clients.dal", () => ({
  expedionClientsDal: {},
}));
vi.mock("@/server/dal/users.dal", () => ({ userHasRole: vi.fn() }));

import { expedionClientsDal } from "@/server/dal/expedion-clients.dal";
import { userHasRole } from "@/server/dal/users.dal";

import {
  ExpedionClientError,
  expedionClientsService,
} from "../expedion-clients.service";

const ADMIN = "admin-1";

const row = (over: Record<string, unknown> = {}) => ({
  ownerId: "uid-1",
  firstName: "Camille",
  lastName: "Roux",
  email: "camille@example.fr",
  phone: "+33600000000",
  city: "Lyon",
  quoteCount: 3,
  paidCount: 2,
  deliveredCount: 1,
  paidValueCents: 24_000,
  firstSeenAt: new Date("2026-01-02T10:00:00Z"),
  lastSeenAt: new Date("2026-06-02T10:00:00Z"),
  accountUserId: null,
  accountName: null,
  accountEmail: null,
  accountBanned: null,
  ...over,
});

const quote = (over: Record<string, unknown> = {}) => ({
  id: "q-1",
  quoteNumber: "D-1",
  bordereauNumber: "BX-99",
  status: "paid",
  paymentStatus: "paid",
  acceptedPriceCents: 12_000,
  pickupCity: "Paris",
  deliveryCity: "Lyon",
  listingId: null,
  createdAt: new Date("2026-06-02T10:00:00Z"),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(expedionClientsDal, {
    list: vi.fn().mockResolvedValue([row()]),
    count: vi.fn().mockResolvedValue(1),
    getOne: vi.fn().mockResolvedValue(row()),
    quotesFor: vi.fn().mockResolvedValue([quote()]),
  });
  vi.mocked(userHasRole).mockResolvedValue(true);
});

describe("expedionClientsService.list", () => {
  it("refuses a session without the admin role", async () => {
    vi.mocked(userHasRole).mockResolvedValue(false);

    await expect(expedionClientsService.list("nobody", {})).rejects.toMatchObject(
      { code: "FORBIDDEN", status: 403 }
    );
    // Refused before the query, not after it.
    expect(expedionClientsDal.list).not.toHaveBeenCalled();
  });

  it("checks the role in the service, so no route can skip it", async () => {
    await expedionClientsService.list(ADMIN, {});

    expect(userHasRole).toHaveBeenCalledWith(ADMIN, "admin");
  });

  it("applies the documented defaults", async () => {
    await expedionClientsService.list(ADMIN, {});

    expect(expedionClientsDal.list).toHaveBeenCalledWith({
      search: undefined,
      linked: "all",
      sortBy: "lastSeen",
      sortOrder: "desc",
      page: 1,
      pageSize: 25,
    });
  });

  it("passes the search term through so an owner matches on any of their quotes", async () => {
    await expedionClientsService.list(ADMIN, { search: " BX-99 " });

    expect(expedionClientsDal.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: "BX-99" })
    );
  });

  it("rejects a page size beyond the cap rather than issuing it", async () => {
    await expect(
      expedionClientsService.list(ADMIN, { pageSize: 5_000 })
    ).rejects.toBeDefined();
    expect(expedionClientsDal.list).not.toHaveBeenCalled();
  });

  it("paginates against the owner count, not the row count", async () => {
    vi.mocked(expedionClientsDal.count).mockResolvedValue(51);

    const result = await expedionClientsService.list(ADMIN, { pageSize: 25 });

    expect(result.total).toBe(51);
    expect(result.totalPages).toBe(3);
  });

  it("reports one page when nothing matches, never zero", async () => {
    vi.mocked(expedionClientsDal.count).mockResolvedValue(0);
    vi.mocked(expedionClientsDal.list).mockResolvedValue([]);

    const result = await expedionClientsService.list(ADMIN, {});

    expect(result.clients).toEqual([]);
    expect(result.totalPages).toBe(1);
  });

  it("joins the two name parts once, in the service", async () => {
    const { clients } = await expedionClientsService.list(ADMIN, {});

    expect(clients[0].name).toBe("Camille Roux");
  });

  it("reports a missing name as null, not an empty string", async () => {
    vi.mocked(expedionClientsDal.list).mockResolvedValue([
      row({ firstName: null, lastName: null }),
    ]);

    const { clients } = await expedionClientsService.list(ADMIN, {});

    expect(clients[0].name).toBeNull();
  });

  it("keeps a client who gave only a surname", async () => {
    vi.mocked(expedionClientsDal.list).mockResolvedValue([
      row({ firstName: null, lastName: "Roux" }),
    ]);

    const { clients } = await expedionClientsService.list(ADMIN, {});

    expect(clients[0].name).toBe("Roux");
  });

  it("reports no account as null rather than an empty account", async () => {
    const { clients } = await expedionClientsService.list(ADMIN, {});

    expect(clients[0].account).toBeNull();
  });

  it("surfaces the account when the owner key matches a user row", async () => {
    vi.mocked(expedionClientsDal.list).mockResolvedValue([
      row({
        accountUserId: "user-9",
        accountName: "Camille",
        accountEmail: "camille@example.fr",
        accountBanned: true,
      }),
    ]);

    const { clients } = await expedionClientsService.list(ADMIN, {});

    expect(clients[0].account).toEqual({
      id: "user-9",
      name: "Camille",
      email: "camille@example.fr",
      banned: true,
    });
  });

  it("serialises timestamps, so the wire carries no Date", async () => {
    const { clients } = await expedionClientsService.list(ADMIN, {});

    expect(clients[0].lastSeenAt).toBe("2026-06-02T10:00:00.000Z");
    expect(clients[0].firstSeenAt).toBe("2026-01-02T10:00:00.000Z");
  });
});

describe("expedionClientsService.getOne", () => {
  it("refuses a session without the admin role", async () => {
    vi.mocked(userHasRole).mockResolvedValue(false);

    await expect(
      expedionClientsService.getOne("nobody", "uid-1")
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    expect(expedionClientsDal.getOne).not.toHaveBeenCalled();
  });

  it("404s on an owner key that matches no quote", async () => {
    vi.mocked(expedionClientsDal.getOne).mockResolvedValue(null);

    await expect(
      expedionClientsService.getOne(ADMIN, "ghost")
    ).rejects.toMatchObject({ code: "CLIENT_NOT_FOUND", status: 404 });
  });

  it("throws the typed error the route layer knows how to translate", async () => {
    vi.mocked(expedionClientsDal.getOne).mockResolvedValue(null);

    await expect(
      expedionClientsService.getOne(ADMIN, "ghost")
    ).rejects.toBeInstanceOf(ExpedionClientError);
  });

  it("returns the client with their quotes, newest first from the DAL", async () => {
    const result = await expedionClientsService.getOne(ADMIN, "uid-1");

    expect(result.client.ownerId).toBe("uid-1");
    expect(result.quotes).toHaveLength(1);
    expect(result.quotes[0]).toMatchObject({
      id: "q-1",
      bordereauNumber: "BX-99",
      createdAt: "2026-06-02T10:00:00.000Z",
    });
  });

  it("agrees with the list row about the totals", async () => {
    const [listed] = (await expedionClientsService.list(ADMIN, {})).clients;
    const { client } = await expedionClientsService.getOne(ADMIN, "uid-1");

    expect(client).toEqual(listed);
  });
});
