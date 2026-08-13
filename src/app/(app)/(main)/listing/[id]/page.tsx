import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { JobDetail } from "@/features/app/listing/ui";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ListingPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  return <JobDetail listingId={id} viewerId={session?.user.id ?? null} />;
}
