import { describe, it, expect, vi, beforeEach } from "vitest";

import { GET } from "../route";
import { GET as GET_COUNTS } from "../counts/route";
import { auth } from "@/lib/auth";
import { messagesService } from "@/server/services/messages.service";
import { CONVERSATION_FILTERS } from "@/lib/conversation-filter";

/**
 * What the list route adds to the inbox read: the session gate, and a
 * validated `filter` — the state of the job a conversation is about
 * (client feedback 2026-11-19, #26).
 */
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

vi.mock("@/server/services/messages.service", () => ({
  messagesService: { getInbox: vi.fn(), getInboxCounts: vi.fn() },
}));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers()),
}));

const getSession = vi.mocked(auth.api.getSession);
const getInbox = vi.mocked(messagesService.getInbox);
const getInboxCounts = vi.mocked(messagesService.getInboxCounts);

const list = (query = "") =>
  GET(new Request(`http://localhost/api/messages/conversations${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ user: { id: "u1" } } as never);
  getInbox.mockResolvedValue({ items: [], page: 1, limit: 20 });
  getInboxCounts.mockResolvedValue({ all: 3, waiting: 1, active: 1, done: 0, none: 1 });
});

describe("GET /api/messages/conversations", () => {
  it("refuses a caller with no session", async () => {
    getSession.mockResolvedValue(null as never);

    const res = await list("?filter=active");

    expect(res.status).toBe(401);
    expect(getInbox).not.toHaveBeenCalled();
  });

  it("reads every conversation when no filter is named", async () => {
    const res = await list();

    expect(res.status).toBe(200);
    expect(getInbox).toHaveBeenCalledWith("u1", {
      page: 1,
      limit: 20,
      search: undefined,
      filter: "all",
    });
  });

  it.each(CONVERSATION_FILTERS)("passes « %s » down as the session's own read", async (filter) => {
    await list(`?filter=${filter}&search=Clamart&page=2&limit=50`);

    expect(getInbox).toHaveBeenCalledWith("u1", {
      page: 2,
      limit: 50,
      search: "Clamart",
      filter,
    });
  });

  it.each(["unread", "OPEN", "open", "waiting,active"])(
    "answers 400 to a filter the chips do not offer (%s)",
    async (filter) => {
      const res = await list(`?filter=${encodeURIComponent(filter)}`);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(getInbox).not.toHaveBeenCalled();
    }
  );

  it("answers 400 to a page size beyond the cap", async () => {
    const res = await list("?limit=500");

    expect(res.status).toBe(400);
    expect(getInbox).not.toHaveBeenCalled();
  });
});

describe("GET /api/messages/conversations/counts", () => {
  it("refuses a caller with no session", async () => {
    getSession.mockResolvedValue(null as never);

    const res = await GET_COUNTS();

    expect(res.status).toBe(401);
    expect(getInboxCounts).not.toHaveBeenCalled();
  });

  it("counts the session's own inbox, and nobody else's", async () => {
    const res = await GET_COUNTS();
    const body = await res.json();

    expect(getInboxCounts).toHaveBeenCalledWith("u1");
    expect(body).toEqual({
      success: true,
      data: { all: 3, waiting: 1, active: 1, done: 0, none: 1 },
    });
  });
});
