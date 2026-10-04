import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { RequestPostedScreen } from "@/features/app/create/ui";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Where `/create` lands after a request is published or scheduled
 * (request_posted_page_spec.md). The proxy does not guard `/create`, so the
 * session is checked here; ownership is checked by the screen against the row.
 */
export default async function RequestPostedPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/create/success/${id}`)}`);
  }

  return <RequestPostedScreen listingId={id} viewerId={session.user.id} />;
}
