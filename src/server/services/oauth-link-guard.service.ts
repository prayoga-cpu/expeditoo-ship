import * as accountsDAL from "@/server/dal/accounts.dal";
import * as sessionsDAL from "@/server/dal/sessions.dal";
import * as usersDAL from "@/server/dal/users.dal";

/**
 * Close the pre-registration takeover on Google account linking.
 *
 * Anybody can sign up with somebody else's address and a password of their
 * choosing; they cannot sign in, because the address is unverified. When the
 * real owner later presses « Continuer avec Google », Better Auth links Google
 * to that row (`trustedProviders: ["google"]`) and marks it verified — and the
 * stranger's password, which was never proven to belong to anyone, would then
 * open the account.
 *
 * So, when an outside provider is about to be linked to an account whose
 * address was never confirmed, the password sign-in is removed and any
 * session is ended. The owner keeps Google and can set a password later
 * through « Mot de passe oublié ». Runs in the `before` hook so a failure
 * stops the link rather than completing it with the password still there.
 *
 * `credential` itself, a brand-new user (verified by the provider at
 * creation) and an already verified account are left alone.
 */
export async function guardOAuthLink(userId: string, providerId: string): Promise<{
  droppedPassword: boolean;
}> {
  if (providerId === "credential") return { droppedPassword: false };

  const user = await usersDAL.getUserById(userId);
  if (!user || user.emailVerified) return { droppedPassword: false };

  const dropped = await accountsDAL.deleteCredentialAccounts(userId);
  if (dropped > 0) await sessionsDAL.deleteUserSessions(userId);

  return { droppedPassword: dropped > 0 };
}
