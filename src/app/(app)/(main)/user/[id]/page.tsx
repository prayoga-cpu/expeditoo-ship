import { PublicProfile } from "@/features/app/profile/ui/PublicProfile";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PublicProfile id={id} />;
}
