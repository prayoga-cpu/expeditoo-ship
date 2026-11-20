import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/dal/admin-user-activity.dal", () => ({ adminUserActivityDal: {} }));
vi.mock("@/server/services/user.service", () => ({ hasAnyRole: vi.fn() }));
vi.mock("@/server/services/admin.service", () => ({
  AdminError: class AdminError extends Error {
    constructor(
      public code: string,
      message: string,
      public status: number
    ) {
      super(message);
    }
  },
}));
// The write side of messaging. Mocked so a call would be seen, never made.
vi.mock("@/server/dal/messages.dal", () => ({
  messagesDAL: { markAsRead: vi.fn(), markAllAsSeen: vi.fn(), updateLastRead: vi.fn() },
}));
vi.mock("@/server/services/messages.service", () => ({
  messagesService: { getThread: vi.fn(), markSeen: vi.fn() },
}));

import {
  ACTIVITY_READER_ROLES,
  adminUserActivityService as service,
} from "../admin-user-activity.service";
import { adminUserActivityDal } from "@/server/dal/admin-user-activity.dal";
import { AdminError } from "@/server/services/admin.service";
import { hasAnyRole } from "@/server/services/user.service";
import * as messagesDalModule from "@/server/dal/messages.dal";
import * as messagesServiceModule from "@/server/services/messages.service";

/**
 * admin_user_management_spec.md §7 — one account's requests, offers and
 * conversations, read by admin and support, by nobody else, and without a
 * single write.
 */

const NOW = new Date("2026-11-20T10:00:00.000Z");

const job = {
  id: "l1",
  reference: 100042,
  title: "Commode Louis XV",
  pickupCity: "Lyon",
  dropoffCity: "Marseille",
  status: "open",
};

const conversationRow = {
  id: "c1",
  type: "LISTING",
  lastMessageAt: NOW,
  createdAt: NOW,
  job,
};

const dal = adminUserActivityDal as unknown as Record<string, ReturnType<typeof vi.fn>>;

/** Which roles the caller holds, answered the way `hasAnyRole` would. */
function callerHolds(...held: string[]) {
  vi.mocked(hasAnyRole).mockImplementation(async (_id, wanted) =>
    wanted.some((role) => held.includes(role))
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(adminUserActivityDal, {
    getUser: vi.fn().mockResolvedValue({ id: "u1", name: "Nicolas Denis", email: "n@example.com" }),
    countRequests: vi.fn().mockResolvedValue(1),
    listRequests: vi.fn().mockResolvedValue([
      { ...job, pickupFrom: NOW, expiresAt: NOW, offersCount: 3, createdAt: NOW },
    ]),
    countOffers: vi.fn().mockResolvedValue(1),
    listOffers: vi.fn().mockResolvedValue([
      { id: "o1", priceCents: 21_000, status: "pending", createdAt: NOW, job },
    ]),
    countConversations: vi.fn().mockResolvedValue(1),
    listConversations: vi.fn().mockResolvedValue([conversationRow]),
    getConversationOf: vi.fn().mockResolvedValue(conversationRow),
    otherParties: vi.fn().mockResolvedValue([
      { conversationId: "c1", id: "u2", name: "Jean Transport" },
    ]),
    messageCounts: vi.fn().mockResolvedValue([{ conversationId: "c1", value: 2 }]),
    countMessages: vi.fn().mockResolvedValue(2),
    listMessages: vi.fn().mockResolvedValue([
      {
        id: "m2",
        senderId: "u2",
        senderName: "Jean Transport",
        content: "Offre",
        attachmentUrl: null,
        createdAt: NOW,
        offerPriceCents: 21_000,
        offerStatus: "pending",
      },
      {
        id: "m1",
        senderId: "u1",
        senderName: "Nicolas Denis",
        content: "Bonjour",
        attachmentUrl: "https://files.example/a.jpg",
        createdAt: NOW,
        offerPriceCents: null,
        offerStatus: null,
      },
    ]),
  });
  callerHolds("admin");
});

async function refusal(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    if (error instanceof AdminError) return { code: error.code, status: error.status };
    throw error;
  }
  throw new Error("expected a refusal");
}

const READS: [string, () => Promise<unknown>][] = [
  ["summary", () => service.summary("viewer", "u1")],
  ["requests", () => service.requests("viewer", "u1")],
  ["offers", () => service.offers("viewer", "u1")],
  ["conversations", () => service.conversations("viewer", "u1")],
  ["thread", () => service.thread("viewer", "u1", "c1")],
];

describe("who may read an account's activity", () => {
  it("is admin and support, and the list says so", () => {
    expect([...ACTIVITY_READER_ROLES]).toEqual(["admin", "support"]);
  });

  it.each(["admin", "support"])("lets %s read every list", async (role) => {
    callerHolds("shipper", role);
    for (const [, read] of READS) await expect(read()).resolves.toBeDefined();
  });

  it.each([
    ["a plain account", ["shipper"]],
    ["a transporter", ["shipper", "carrier", "driver"]],
    ["an operator", ["shipper", "operator"]],
    ["finance", ["shipper", "finance"]],
  ])("refuses %s on every read, before touching the database", async (_who, roles) => {
    callerHolds(...roles);
    for (const [, read] of READS) {
      expect(await refusal(read)).toEqual({ code: "FORBIDDEN_ROLE", status: 403 });
    }
    for (const fn of Object.values(dal)) expect(fn).not.toHaveBeenCalled();
  });

  it("answers 404 for an account that does not exist, on every read", async () => {
    dal.getUser.mockResolvedValue(undefined);
    for (const [, read] of READS) {
      expect(await refusal(read)).toEqual({ code: "USER_NOT_FOUND", status: 404 });
    }
    expect(dal.listRequests).not.toHaveBeenCalled();
    expect(dal.listMessages).not.toHaveBeenCalled();
  });

  it("does not tell a stranger whether the account exists", async () => {
    callerHolds("shipper");
    dal.getUser.mockResolvedValue(undefined);
    expect(await refusal(() => service.summary("viewer", "nobody"))).toEqual({
      code: "FORBIDDEN_ROLE",
      status: 403,
    });
  });
});

describe("what is read", () => {
  it("summarises the account and its three counts", async () => {
    expect(await service.summary("viewer", "u1")).toEqual({
      user: { id: "u1", name: "Nicolas Denis", email: "n@example.com" },
      counts: { requests: 1, offers: 1, conversations: 1 },
    });
  });

  it("pages every list at 50, newest first, from the page asked for", async () => {
    dal.countRequests.mockResolvedValue(120);
    const page = await service.requests("viewer", "u1", { page: "2" });

    expect(dal.listRequests).toHaveBeenCalledWith("u1", { limit: 50, offset: 50 });
    expect(page).toMatchObject({ page: 2, pageSize: 50, total: 120, hasMore: true });
  });

  it("refuses a page that is not a positive number", async () => {
    await expect(service.offers("viewer", "u1", { page: "0" })).rejects.toThrow();
    expect(dal.listOffers).not.toHaveBeenCalled();
  });

  it("names the other party and counts the messages of each conversation", async () => {
    const { items } = await service.conversations("viewer", "u1");

    expect(items[0]).toMatchObject({
      id: "c1",
      others: [{ id: "u2", name: "Jean Transport" }],
      messageCount: 2,
      job: { reference: 100042, pickupCity: "Lyon", dropoffCity: "Marseille" },
    });
  });

  it("shows a thread offer as its price and current status", async () => {
    const { messages } = await service.thread("viewer", "u1", "c1");

    expect(messages.items[0].offer).toEqual({ priceCents: 21_000, status: "pending" });
    expect(messages.items[1].offer).toBeNull();
    expect(messages.items[1].hasAttachment).toBe(true);
  });

  it("answers 404 for a conversation the account is not in", async () => {
    dal.getConversationOf.mockResolvedValue(undefined);

    expect(await refusal(() => service.thread("viewer", "u1", "someone-elses"))).toEqual({
      code: "CONVERSATION_NOT_FOUND",
      status: 404,
    });
    expect(dal.getConversationOf).toHaveBeenCalledWith("u1", "someone-elses");
    expect(dal.listMessages).not.toHaveBeenCalled();
  });
});

describe("reading writes nothing", () => {
  const SERVER = join(__dirname, "..", "..");
  const source = (path: string) => readFileSync(join(SERVER, path), "utf8");

  it("never reaches the messaging service or its DAL, which mark threads read", async () => {
    for (const [, read] of READS) await read();

    const writers = [
      ...Object.values(messagesDalModule.messagesDAL as Record<string, unknown>),
      ...Object.values(messagesServiceModule.messagesService as Record<string, unknown>),
    ];
    for (const fn of writers) expect(fn).not.toHaveBeenCalled();
  });

  it("has a DAL made of selects only", () => {
    const dalSource = source("dal/admin-user-activity.dal.ts");

    expect(dalSource).not.toMatch(/\.(insert|update|delete|execute|transaction)\(/);
    expect(dalSource).not.toMatch(/\b(insert into|update\s+\w+\s+set|delete from)\b/i);
  });

  it("imports no DAL but its own, and no service that writes", () => {
    const imports = [
      ...source("services/admin-user-activity.service.ts").matchAll(/from "(@\/server\/[^"]+)"/g),
    ].map((match) => match[1]);

    expect(imports.sort()).toEqual([
      "@/server/dal/admin-user-activity.dal",
      "@/server/dto/admin-user-activity.dto",
      "@/server/services/admin.service",
      "@/server/services/user.service",
    ]);
  });

  it("exposes GET and nothing else on every route", () => {
    const routes = [
      "activity",
      "requests",
      "offers",
      "conversations",
      "conversations/[conversationId]",
    ];
    for (const route of routes) {
      const text = readFileSync(
        join(SERVER, "..", "app/api/admin/users/[id]", route, "route.ts"),
        "utf8"
      );
      expect([...text.matchAll(/export async function (\w+)/g)].map((m) => m[1])).toEqual(["GET"]);
    }
  });
});
