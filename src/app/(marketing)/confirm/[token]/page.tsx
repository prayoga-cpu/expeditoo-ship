import { ConfirmMilestone } from "@/features/app/confirm";

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
