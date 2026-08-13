import { use } from "react";
import { SellerProfile } from "@/features/app/profile/ui/SellerProfile";

export default function SellerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SellerProfile sellerId={id} />;
}

