import { useState, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { shareContent } from "@/lib/share";

/**
 * Custom hook for create success page
 * Follows Single Responsibility Principle - handles success page logic
 *
 * Manages listing ID, share link, and navigation
 */
export function useCreateSuccess() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);

  // Get auction ID from URL params
  const auctionId = searchParams.get("id") || "12345";

  // Generate share link (Auction Detail)
  const shareLink = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/auction/${auctionId}`;
  }, [auctionId]);

  // Handle copy link to clipboard
  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareLink]);

  // Handle share using Web Share API
  const handleShare = useCallback(async () => {
    await shareContent({
      title: "My Auction Listing",
      text: "Check out my auction listing on EXPEDITOO",
      url: shareLink,
      onCopy: handleCopyLink
    });
  }, [shareLink, handleCopyLink]);

  // Navigate to auction detail
  const viewAuction = useCallback(() => {
    router.push(`/listing/${auctionId}`);
  }, [router, auctionId]);

  // Navigate to home
  const goToHome = useCallback(() => {
    router.push("/home");
  }, [router]);

  return {
    auctionId,
    paymentLink: shareLink,
    copied,
    handleCopyLink,
    handleShare,
    viewAuction,
    goToHome,
  };
}
