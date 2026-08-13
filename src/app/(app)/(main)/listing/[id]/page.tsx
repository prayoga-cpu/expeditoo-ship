import { use } from "react";
import { AuctionDetail } from "@/features/app/auction/ui";

export default function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  // TODO: Determine if listing is auction or standard listing based on ID or data
  // For now, rendering AuctionDetail as requested for testing realtime features
  return <AuctionDetail id={id} />;
}
