import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The pseudo in message payloads (client feedback 2026-11-19, #32).
 *
 * The harness keeps what each relational read was asked for, so what is
 * asserted is the column list: `alias` joined the participant and sender
 * selections, and nothing else of `user` came with it.
 */

const captured = vi.hoisted(() => ({
  inbox: undefined as unknown,
  messages: undefined as unknown,
  thread: undefined as unknown,
  rows: [] as unknown[],
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      conversationParticipants: {
        findMany: async (args: unknown) => {
          captured.inbox = args;
          return captured.rows;
        },
      },
      messages: {
        findMany: async (args: unknown) => {
          captured.messages = args;
          return [];
        },
      },
      conversations: {
        findFirst: async (args: unknown) => {
          captured.thread = args;
          return undefined;
        },
      },
    },
  },
}));

import { messagesDAL } from "../messages.dal";

const USER_COLUMNS = ["alias", "firstName", "id", "image", "lastName", "name"];

type UserSelection = { columns: Record<string, boolean> };

const conv = (id: string, other: { name: string; alias?: string | null }) => ({
  conversation: {
    id,
    lastMessageAt: new Date("2026-11-18T10:00:00Z"),
    participants: [
      { user: { id: "me", name: "Moi", alias: "moi-meme" } },
      { user: { id: `other-${id}`, ...other } },
    ],
    listing: null,
    messages: [],
  },
});

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

beforeEach(() => {
  captured.rows = [
    conv("pseudo", { name: "Nicolas Martin", alias: "Nico-Trans" }),
    conv("plain", { name: "Élodie Durand", alias: null }),
  ];
});

describe("messagesDAL — the pseudo in the payload", () => {
  it("selects the alias for inbox participants, and nothing else new", async () => {
    await messagesDAL.getUserConversations("me", 50, 0);

    const user = (
      captured.inbox as {
        with: { conversation: { with: { participants: { with: { user: UserSelection } } } } };
      }
    ).with.conversation.with.participants.with.user;
    expect(Object.keys(user.columns).sort()).toEqual(USER_COLUMNS);
  });

  it("selects the alias for a message's sender", async () => {
    await messagesDAL.getMessages("c1", 50, 0);

    const sender = (captured.messages as { with: { sender: UserSelection } }).with.sender;
    expect(Object.keys(sender.columns).sort()).toEqual(USER_COLUMNS);
  });

  it("selects the alias for a thread's participants", async () => {
    await messagesDAL.getConversationById("c1");

    const user = (
      captured.thread as { with: { participants: { with: { user: UserSelection } } } }
    ).with.participants.with.user;
    expect(Object.keys(user.columns).sort()).toEqual(USER_COLUMNS);
  });
});

describe("messagesDAL.getUserConversations — search by pseudo", () => {
  it("finds a conversation by the other person's pseudo, case and accents aside", async () => {
    expect(ids(await messagesDAL.getUserConversations("me", 50, 0, "nico-trans"))).toEqual([
      "pseudo",
    ]);
    expect(ids(await messagesDAL.getUserConversations("me", 50, 0, "NICO"))).toEqual(["pseudo"]);
  });

  it("finds it with the « @ » the row shows", async () => {
    expect(ids(await messagesDAL.getUserConversations("me", 50, 0, "@nico"))).toEqual(["pseudo"]);
  });

  it("still finds a person by their name", async () => {
    expect(ids(await messagesDAL.getUserConversations("me", 50, 0, "martin"))).toEqual(["pseudo"]);
    expect(ids(await messagesDAL.getUserConversations("me", 50, 0, "elodie"))).toEqual(["plain"]);
  });

  it("never matches on the caller's own pseudo", async () => {
    expect(await messagesDAL.getUserConversations("me", 50, 0, "moi-meme")).toEqual([]);
  });
});
