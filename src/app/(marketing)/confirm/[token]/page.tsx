import type { Metadata } from "next";

import { ConfirmMilestone } from "@/features/app/confirm";

// A one-tap link out of a text message: named for what it asks, and kept out
// of search results, since the token in the path is the whole authority.
export const metadata: Metadata = {
  title: "Confirmer votre transport",
  robots: { index: false, follow: false },
};

/**
 * The public landing page for a client's one-tap confirmation link.
 *
 * Reachable without a session — most Expedion clients have no account here at
 * all. The token in the path is the whole authority and grants nothing but the
 * right to record one attestation.
 */
export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <ConfirmMilestone token={token} />;
}
