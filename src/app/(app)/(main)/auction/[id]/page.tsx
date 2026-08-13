import { use } from "react";
import { AuctionDetail } from "@/features/app/auction/ui";

export default function AuctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <AuctionDetail id={id} />;
}
