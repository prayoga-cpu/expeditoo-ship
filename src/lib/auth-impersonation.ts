import { z } from "zod";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, getSessionFromCtx } from "better-auth/api";
import { deleteSessionCookie, setSessionCookie } from "better-auth/cookies";
import {
  ImpersonationError,
  IMPERSONATION_DURATION_SECONDS,
  assertCanImpersonate,
  recordEnd,
  recordStart,
} from "@/server/services/impersonation.service";

/**
 * Impersonation, permissioned off `user_roles`.
 *
 * Better Auth ships this in its own `admin` plugin, but that plugin decides who
 * is an admin from a `user.role` string column -- a second, competing source of
 * truth next to the `user_roles` table, which is exactly the drift CLAUDE.md
 * warns about. The endpoints below are the same mechanism with the permission
 * check delegated to our service layer, and an audit row per impersonation.
 *
 * Session minting and cookie signing have to happen here: an endpoint context
 * is the only place that can sign a Better Auth session cookie.
 */

/** Holds the admin's own session token while they are somebody else. */
const ADMIN_SESSION_COOKIE = "admin_session";

function toAPIError(error: unknown): never {
  if (error instanceof ImpersonationError) {
    const status =
      error.status === 400
        ? "BAD_REQUEST"
        : error.status === 404
          ? "NOT_FOUND"
          : "FORBIDDEN";
    throw new APIError(status, { message: error.message, code: error.code });
  }
  throw error;
}

/** `impersonatedBy` is ours; Better Auth's own session type does not know it. */
function impersonatorOf(session: unknown): string | null {
  return (session as { impersonatedBy?: string | null }).impersonatedBy ?? null;
}

export const impersonation = () =>
  ({
    id: "expeditoo-impersonation",

    // Declaring the column is what lets the adapter read and write it; the
    // column itself lives in src/db/schema/users.ts.
    schema: {
      session: {
        fields: {
          impersonatedBy: { type: "string", required: false },
        },
      },
    },

    endpoints: {
      impersonateUser: createAuthEndpoint(
        "/impersonate-user",
        {
          method: "POST",
          body: z.object({ userId: z.string().min(1) }),
          requireHeaders: true,
        },
        async (ctx) => {
          const current = await getSessionFromCtx(ctx);

          if (!current) {
            throw new APIError("UNAUTHORIZED", {
              message: "Authentication required",
            });
          }

          if (impersonatorOf(current.session)) {
            throw new APIError("FORBIDDEN", {
              message: "Stop the current impersonation first",
              code: "ALREADY_IMPERSONATING",
            });
          }

          const { admin, target } = await assertCanImpersonate(
            current.user.id,
            ctx.body.userId
          ).catch(toAPIError);

          const targetUser = await ctx.context.internalAdapter.findUserById(
            target.id
          );

          if (!targetUser) {
            throw new APIError("NOT_FOUND", { message: "User not found" });
          }

          const expiresAt = new Date(
            Date.now() + IMPERSONATION_DURATION_SECONDS * 1000
          );

          const borrowed = await ctx.context.internalAdapter.createSession(
            targetUser.id,
            true,
            { impersonatedBy: admin.id, expiresAt },
            true
          );

          if (!borrowed) {
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "Failed to create the impersonation session",
            });
          }

          // Park the admin's own session token rather than revoking it, so
          // stopping returns them to the session they already had.
          const dontRememberMe = await ctx.getSignedCookie(
            ctx.context.authCookies.dontRememberToken.name,
            ctx.context.secret
          );
          const adminCookie = ctx.context.createAuthCookie(ADMIN_SESSION_COOKIE);

          deleteSessionCookie(ctx);
          await ctx.setSignedCookie(
            adminCookie.name,
            `${current.session.token}:${dontRememberMe || ""}`,
            ctx.context.secret,
            ctx.context.authCookies.sessionToken.options
          );
          await setSessionCookie(
            ctx,
            { session: borrowed, user: targetUser },
            true
          );

          await recordStart({
            adminId: admin.id,
            adminEmail: admin.email,
            targetUserId: targetUser.id,
            targetEmail: targetUser.email,
            sessionToken: borrowed.token,
            expiresAt,
            ipAddress: ctx.headers?.get("x-forwarded-for") ?? null,
            userAgent: ctx.headers?.get("user-agent") ?? null,
          });

          return ctx.json({
            user: {
              id: targetUser.id,
              name: targetUser.name,
              email: targetUser.email,
            },
            expiresAt: expiresAt.toISOString(),
          });
        }
      ),

      stopImpersonating: createAuthEndpoint(
        "/stop-impersonating",
        { method: "POST", requireHeaders: true },
        async (ctx) => {
          const adminCookieName =
            ctx.context.createAuthCookie(ADMIN_SESSION_COOKIE).name;
          const parked = await ctx.getSignedCookie(
            adminCookieName,
            ctx.context.secret
          );
          const current = await getSessionFromCtx(ctx);
          const impersonatedBy = current
            ? impersonatorOf(current.session)
            : null;

          const clearParked = () =>
            ctx.setSignedCookie(adminCookieName, "", ctx.context.secret, {
              ...ctx.context.authCookies.sessionToken.options,
              maxAge: 0,
            });

          // The borrowed session may already be gone -- it expires on its own
          // after an hour -- and the parked cookie is then the only way back.
          // Without this the admin is bounced to the sign-in screen while
          // their own session is still perfectly alive.
          if (!parked) {
            if (!current) {
              throw new APIError("UNAUTHORIZED", {
                message: "Authentication required",
              });
            }
            throw new APIError(
              impersonatedBy ? "INTERNAL_SERVER_ERROR" : "BAD_REQUEST",
              impersonatedBy
                ? {
                    message: "The original session is gone; sign in again",
                    code: "ADMIN_SESSION_LOST",
                  }
                : {
                    message: "You are not impersonating anyone",
                    code: "NOT_IMPERSONATING",
                  }
            );
          }

          const [adminSessionToken, dontRememberMe] = parked.split(":");
          const adminSession =
            await ctx.context.internalAdapter.findSession(adminSessionToken);

          if (!adminSession) {
            await clearParked();
            throw new APIError("INTERNAL_SERVER_ERROR", {
              message: "The original session is gone; sign in again",
              code: "ADMIN_SESSION_LOST",
            });
          }

          if (impersonatedBy) {
            // Live impersonation: the parked session must be the admin the
            // borrowed one names, or this is not our cookie to honour.
            if (adminSession.session.userId !== impersonatedBy) {
              throw new APIError("INTERNAL_SERVER_ERROR", {
                message: "The original session is gone; sign in again",
                code: "ADMIN_SESSION_LOST",
              });
            }

            await ctx.context.internalAdapter.deleteSession(
              current!.session.token
            );
            await recordEnd(current!.session.token);
          } else if (current) {
            // Somebody is signed in normally on a browser still carrying a
            // parked cookie. Restoring it for anyone but its owner would hand
            // them the admin's session, so it is dropped instead.
            if (adminSession.session.userId !== current.user.id) {
              await clearParked();
              throw new APIError("BAD_REQUEST", {
                message: "You are not impersonating anyone",
                code: "NOT_IMPERSONATING",
              });
            }
          }
          // Nothing else to check when `current` is null: the borrowed session
          // expired or was revoked, and the signed, http-only parked cookie is
          // the credential -- exactly as strong as the session cookie it
          // replaces. The audit row is left open; its `expiresAt` is what says
          // the impersonation ran to its ceiling rather than being stopped.

          await setSessionCookie(ctx, adminSession, !!dontRememberMe);

          // Starting an impersonation sets `dont_remember` (the borrowed
          // session is deliberately not remembered). setSessionCookie only
          // ever *writes* that cookie, never clears it, so without this the
          // flag rides back into the admin's own session and quietly stops it
          // renewing -- they get signed out early for having looked at
          // somebody's account.
          if (!dontRememberMe) {
            ctx.setCookie(ctx.context.authCookies.dontRememberToken.name, "", {
              ...ctx.context.authCookies.dontRememberToken.options,
              maxAge: 0,
            });
          }

          await clearParked();

          return ctx.json({
            user: {
              id: adminSession.user.id,
              name: adminSession.user.name,
              email: adminSession.user.email,
            },
          });
        }
      ),
    },
  }) satisfies BetterAuthPlugin;
