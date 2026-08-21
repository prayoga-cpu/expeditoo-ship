/**
 * ============================================================================
 * API: Expedion support chat
 * ============================================================================
 *
 * GET  /api/expedion/support   The caller's support thread, created on demand.
 * POST /api/expedion/support   Post one message into it.
 *
 * Replaces Expedion's contact form, which posted into Airtable and was
 * therefore write-only: the visitor never learned whether anyone had read it,
 * and an operator answering had to leave the product to do it. This writes to
 * the same `conversations` / `messages` tables the website's support chat uses,
 * with `type: "SUPPORT"`, so an Expedion message lands in the existing admin
 * inbox (`/admin/support`) next to the Expeditoo ones and is answered the same
 * way. Nothing about the admin side had to change to receive them.
 *
 * Why this route exists at all when `/api/chat/support` and `/api/messages`
 * already do the same work: only `/api/auth/*` and `/api/expedion/*` carry CORS
 * headers (`src/proxy.ts`), and the Flutter app is a different origin. Calling
 * the web routes directly would fail at the browser's preflight — before the
 * request is ever dispatched, and so indistinguishable from the server being
 * down. The work itself is delegated to `messagesService`, not reimplemented.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ExpedionAuthError,
  requireExpedionCaller,
  type ExpedionCaller,
} from "@/lib/expedion-auth";
import { expedionErrorResponse } from "@/lib/expedion-response";
import { messagesService } from "@/server/services/messages.service";
import * as usersDAL from "@/server/dal/users.dal";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  content: z.string().trim().min(1, "Message content is required").max(2000),
});

const threadQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * The Better Auth user this caller writes as.
 *
 * A chat participant is a foreign key into `user`, so unlike a quote — whose
 * owner column takes any opaque string — a support thread cannot be opened for
 * an identity this database has never seen. Three cases:
 *
 *   - Better Auth session: `caller.userId` *is* the row. The normal path.
 *   - Firebase ID token: a real, Google-signed identity, but with an id from
 *     the other system. Matched to a Better Auth row by verified address, the
 *     same rule `requireExpedionCaller` uses to decide admin.
 *   - Shared key: refused outright, and this is the one place the bridge is
 *     stricter than elsewhere. The key authenticates the app, not the person,
 *     so its holder can name any UID — harmless for quotes, which are the
 *     named user's own data either way, but a message is *attributed*: it
 *     appears in the admin inbox under someone's name and is answered as
 *     though they wrote it. Nothing should be able to put words in a user's
 *     mouth, and a key that ships in a native binary is not an identity.
 *
 * The missing-account refusal is 409 rather than 401 because the caller *is*
 * authenticated; what is missing is an Expeditoo account, and the client should
 * say so rather than bounce them through a sign-in they already completed.
 */
async function requireChatUser(caller: ExpedionCaller) {
  if (caller.via === "client-key" || caller.via === "admin-key") {
    throw new ExpedionAuthError(
      "CHAT_IDENTITY_REQUIRED",
      403,
      "Support chat requires a signed-in user, not an app key."
    );
  }

  const direct = await usersDAL.getUserById(caller.userId);
  if (direct) return direct;

  if (caller.email && caller.emailVerified) {
    const linked = await usersDAL.getUserByEmail(caller.email);
    if (linked) return linked;
  }

  throw new ExpedionAuthError(
    "CHAT_ACCOUNT_REQUIRED",
    409,
    "Support chat needs an Expeditoo account for this address."
  );
}

/**
 * Only what the chat UI draws. `getThread` returns the whole conversation,
 * its participants and the other party's review stats; forwarding that would
 * hand the client another user's record for no reason.
 */
function toClientMessage(message: {
  id: string;
  content: string;
  createdAt: Date;
  isOwn: boolean;
  readByOther?: unknown;
  sender?: { id: string; name: string | null; image: string | null } | null;
}) {
  return {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    isOwn: message.isOwn,
    readByOther: Boolean(message.readByOther),
    senderName: message.sender?.name ?? null,
    senderImage: message.sender?.image ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const caller = await requireExpedionCaller(req);
    const user = await requireChatUser(caller);

    const { searchParams } = new URL(req.url);
    const query = threadQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const { conversationId, created } =
      await messagesService.getOrCreateSupportConversation(user.id);

    // A thread created a moment ago has nothing in it, and `getThread` would
    // spend four queries establishing that.
    if (created) {
      return NextResponse.json({
        success: true,
        data: {
          conversationId,
          messages: [],
          page: query.page,
          limit: query.limit,
        },
      });
    }

    const thread = await messagesService.getThread(user.id, conversationId, query);

    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        messages: thread.messages.map(toClientMessage),
        page: thread.page,
        limit: thread.limit,
      },
    });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireExpedionCaller(req);
    const user = await requireChatUser(caller);

    const { content } = sendSchema.parse(await req.json());

    const { conversationId } =
      await messagesService.getOrCreateSupportConversation(user.id);

    // Same service the website posts through, so the Ably fan-out that updates
    // an operator's open thread fires for an Expedion message too.
    const { message } = await messagesService.sendMessage(
      user.id,
      { conversationId, content },
      { name: user.name, image: user.image ?? null }
    );

    return NextResponse.json({
      success: true,
      data: {
        conversationId,
        // Sender attached by hand: `sendMessage` returns the row it inserted,
        // not a joined one, and a message that came back without a name would
        // be the only one in the thread shaped differently from a GET.
        message: toClientMessage({
          ...message,
          isOwn: true,
          sender: { id: user.id, name: user.name, image: user.image ?? null },
        }),
      },
    });
  } catch (error) {
    return expedionErrorResponse(error);
  }
}
