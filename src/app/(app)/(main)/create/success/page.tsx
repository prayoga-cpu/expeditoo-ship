"use client";

import { CreateSuccess } from "@/features/app/create/ui";
import { useCreateSuccess } from "@/features/app/create/hooks";

/**
 * Create success page - Orchestration layer
 * Follows SOLID principle - uses hooks for business logic, passes data to UI components
 */
export default function AuctionSuccessPage() {
  const {
    auctionId,
    paymentLink,
    copied,
    handleCopyLink,
    handleShare,
    viewAuction,
    goToHome,
  } = useCreateSuccess();

  return (
    <CreateSuccess
      auctionId={auctionId}
      paymentLink={paymentLink}
      copied={copied}
      onCopyLink={handleCopyLink}
      onShare={handleShare}
      onViewAuction={viewAuction}
      onGoToHome={goToHome}
    />
  );
}
