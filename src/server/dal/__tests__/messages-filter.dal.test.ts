import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { getTableName, type SQL, type Table } from "drizzle-orm";

/**
 * Conversations by the state of their job (client feedback 2026-11-19, #26).
 *
 * The harness stands in for the two reads and keeps what they were handed.
 * The conditions are rendered by Drizzle's own Postgres dialect, so what is
 * asserted about visibility is the SQL the database would receive.
 */

const captured = vi.hoisted(() => ({
  listWhere: undefined as unknown,
  rows: [] as unknown[],
  count: {
    fields: undefined as unknown,
    from: undefined as unknown,
    inner: undefined as unknown,
    left: undefined as unknown,
    where: undefined as unknown,
    groupBy: undefined as unknown,
    rows: [] as unknown[],
  },
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      conversationParticipants: {
        findMany: async (args: { where: unknown }) => {
          captured.listWhere = args.where;
          return captured.rows;
        },
      },
    },
    select: (fields: unknown) => {
      captured.count.fields = fields;
      const chain = {
        from: (table: unknown) => ((captured.count.from = table), chain),
        innerJoin: (table: unknown, on: unknown) => (
          (captured.count.inner = { table, on }), chain
        ),
        leftJoin: (table: unknown, on: unknown) => (
          (captured.count.left = { table, on }), chain
        ),
        where: (condition: unknown) => ((captured.count.where = condition), chain),
        groupBy: async (column: unknown) => {
          captured.count.groupBy = column;
          return captured.count.rows;
        },
      };
      return chain;
    },
  },
}));

import { messagesDAL } from "../messages.dal";
import { listings } from "@/db/schema/listings";
import { listingStatusEnum } from "@/db/schema/listings";
import { CONVERSATION_BUCKETS, conversationBucket } from "@/lib/conversation-filter";

const render = (condition: unknown) => new PgDialect().sqlToQuery(condition as SQL);

/** One participant row as the relational read returns it. */
const conv = (
  id: string,
  status: string | null,
  extra: { name?: string; city?: string; at?: string } = {}
) => ({
  conversation: {
    id,
    lastMessageAt: new Date(extra.at ?? "2026-11-10T10:00:00Z"),
    participants: [
      { user: { id: "me", name: "Moi" } },
      { user: { id: `other-${id}`, name: extra.name ?? "Nicolas Martin" } },
    ],
    listing: status
      ? {
          id: `l-${id}`,
          title: "Canapé",
          reference: 100001,
          status,
          pickupCity: extra.city ?? "Paris",
          dropoffCity: "Lyon",
        }
      : null,
    messages: [],
  },
});

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

beforeEach(() => {
  captured.listWhere = undefined;
  captured.rows = [
    conv("open", "open", { at: "2026-11-18T10:00:00Z" }),
    conv("scheduled", "scheduled", { at: "2026-11-17T10:00:00Z" }),
    conv("draft", "draft", { at: "2026-11-16T10:00:00Z" }),
    conv("awarded", "awarded", { at: "2026-11-15T10:00:00Z" }),
    conv("running", "in_progress", { at: "2026-11-14T10:00:00Z", city: "Clamart" }),
    conv("completed", "completed", { at: "2026-11-13T10:00:00Z" }),
    conv("cancelled", "cancelled", { at: "2026-11-12T10:00:00Z" }),
    conv("expired", "expired", { at: "2026-11-11T10:00:00Z", city: "Clamart" }),
    conv("support", null, { at: "2026-11-10T10:00:00Z", name: "Support" }),
  ];
  captured.count.rows = [];
});

describe("messagesDAL.getUserConversations — by the state of the job", () => {
  it("returns everything, newest first, when the filter is « all » or absent", async () => {
    const all = await messagesDAL.getUserConversations("me", 50, 0, undefined, "all");
    const absent = await messagesDAL.getUserConversations("me", 50, 0);

    expect(all).toHaveLength(9);
    expect(ids(absent)).toEqual(ids(all));
    expect(all[0].id).toBe("open");
  });

  it("keeps the jobs still waiting for a transporter", async () => {
    const rows = await messagesDAL.getUserConversations("me", 50, 0, undefined, "waiting");
    expect(ids(rows)).toEqual(["open", "scheduled", "draft"]);
  });

  it("keeps the jobs with a transporter chosen and a run not finished", async () => {
    const rows = await messagesDAL.getUserConversations("me", 50, 0, undefined, "active");
    expect(ids(rows)).toEqual(["awarded", "running"]);
  });

  it("keeps the jobs that are over, however they ended", async () => {
    const rows = await messagesDAL.getUserConversations("me", 50, 0, undefined, "done");
    expect(ids(rows)).toEqual(["completed", "cancelled", "expired"]);
  });

  it("keeps the conversations about no job", async () => {
    const rows = await messagesDAL.getUserConversations("me", 50, 0, undefined, "none");
    expect(ids(rows)).toEqual(["support"]);
  });

  it("puts every conversation under exactly one chip", async () => {
    const seen: string[] = [];
    for (const bucket of CONVERSATION_BUCKETS) {
      seen.push(...ids(await messagesDAL.getUserConversations("me", 50, 0, undefined, bucket)));
    }
    expect(seen.sort()).toEqual(
      ids(await messagesDAL.getUserConversations("me", 50, 0)).sort()
    );
  });

  it("combines with the text search", async () => {
    const done = await messagesDAL.getUserConversations("me", 50, 0, "Clamart", "done");
    const active = await messagesDAL.getUserConversations("me", 50, 0, "clamart", "active");
    const none = await messagesDAL.getUserConversations("me", 50, 0, "Clamart", "none");

    expect(ids(done)).toEqual(["expired"]);
    expect(ids(active)).toEqual(["running"]);
    expect(none).toEqual([]);
  });

  it("cuts the page after filtering, so a page is not short of matches", async () => {
    const first = await messagesDAL.getUserConversations("me", 2, 0, undefined, "done");
    const second = await messagesDAL.getUserConversations("me", 2, 2, undefined, "done");

    expect(ids(first)).toEqual(["completed", "cancelled"]);
    expect(ids(second)).toEqual(["expired"]);
  });

  it("reads only the caller's own, undeleted conversations", async () => {
    await messagesDAL.getUserConversations("me", 50, 0, undefined, "active");

    const { sql, params } = render(captured.listWhere);
    expect(sql).toMatch(/"user_id" = \$1/);
    expect(sql).toMatch(/"deleted_at" IS NULL/i);
    expect(params).toEqual(["me"]);
  });
});

describe("messagesDAL.countUserConversationsByListingStatus", () => {
  it("counts per job status in one grouped read", async () => {
    captured.count.rows = [
      { status: "open", count: 2 },
      { status: null, count: 1 },
    ];

    const rows = await messagesDAL.countUserConversationsByListingStatus("me");

    expect(rows).toEqual(captured.count.rows);
    expect(Object.keys(captured.count.fields as object)).toEqual(["status", "count"]);
    expect(captured.count.groupBy).toBe(listings.status);
  });

  it("starts from the caller's participant rows and keeps conversations with no job", async () => {
    await messagesDAL.countUserConversationsByListingStatus("me");

    const { from, inner, left } = captured.count;
    expect(getTableName(from as Table)).toBe("conversation_participants");
    expect(getTableName((inner as { table: Table }).table)).toBe("conversations");
    // A LEFT join: an inner one would drop every support thread and standalone
    // quote, and « Sans annonce » would always read 0.
    expect(getTableName((left as { table: Table }).table)).toBe("listings");
    expect(render((left as { on: SQL }).on).sql).toBe(
      '"listings"."id" = "conversations"."listing_id"'
    );
  });

  it("honours the list's visibility rules: the caller's own, and not deleted", async () => {
    await messagesDAL.countUserConversationsByListingStatus("someone");

    const { sql, params } = render(captured.count.where);
    expect(sql).toBe(
      '("conversation_participants"."user_id" = $1 and "conversation_participants"."deleted_at" is null)'
    );
    // The user id is the only value sent: no date is interpolated (gotcha 23).
    expect(params).toEqual(["someone"]);
  });

  it("groups on a column whose every value has a bucket", () => {
    for (const status of listingStatusEnum.enumValues) {
      expect(CONVERSATION_BUCKETS).toContain(conversationBucket(status));
    }
  });
});
