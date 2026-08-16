import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { JobDetail } from "@/features/app/listing/ui";
import { getUserRoles } from "@/server/dal/users.dal";

interface PageProps {
  params: Promise<{ id: string }>;
}

/** Roles allowed to award an escalated job in the client's place. */
const OPERATING_ROLES = ["operator", "admin"];

export default async function ListingPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  // Resolved here rather than in the client component: the award action is a
  // permission, and a permission read on the client is a suggestion.
  let isOperator = false;
  if (session) {
    const roles = await getUserRoles(session.user.id);
    isOperator = roles.some((r) => OPERATING_ROLES.includes(r.role));
  }

  return (
    <JobDetail
      listingId={id}
      viewerId={session?.user.id ?? null}
      isOperator={isOperator}
    />
  );
}
