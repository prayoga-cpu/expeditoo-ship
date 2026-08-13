"use client";


import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Copy, Share2, Home, Eye } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Pure UI component for create success page
 * Follows Single Responsibility Principle - only handles presentation
 * Business logic handled by useCreateSuccess hook in page
 *
 * @param auctionId - Created auction ID
 * @param paymentLink - Share link for the auction
 * @param copied - Whether link was copied
 * @param onCopyLink - Callback when copy button clicked
 * @param onShare - Callback when share button clicked
 * @param onViewAuction - Callback when view auction clicked
 * @param onGoToHome - Callback when go to home clicked
 */
interface CreateSuccessProps {
  auctionId: string;
  paymentLink: string;
  copied: boolean;
  onCopyLink: () => void;
  onShare: () => void;
  onViewAuction: () => void;
  onGoToHome: () => void;
}

export function CreateSuccess({
  auctionId,
  paymentLink,
  copied,
  onCopyLink,
  onShare,
  onViewAuction,
  onGoToHome,
}: CreateSuccessProps) {
  const t = useTranslations("create.success");
  return (
    <div className="min-h-screen flex items-center justify-center p-4 pb-24 md:pb-6">
      <Card className="max-w-lg w-full p-8 text-center space-y-6">
        {/* Success Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
        </div>

        {/* Success Message */}
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">
            {t("description")}
          </p>
        </div>

        {/* Auction Details */}
        <div className="bg-muted rounded-lg p-4 space-y-2 text-left">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("auctionId")}</span>
            <span className="font-mono font-semibold">#{auctionId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("status")}</span>
            <span className="text-green-600 dark:text-green-400 font-semibold">
              {t("active")}
            </span>
          </div>
        </div>

        {/* Payment Link */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-foreground block text-left">
            {t("shareTitle")}
          </label>
          <div className="flex gap-2">
            <div className="flex-1 bg-muted rounded-lg px-4 py-3 text-sm font-mono text-muted-foreground truncate">
              {paymentLink}
            </div>
            <Button
              onClick={onCopyLink}
              variant="outline"
              size="icon"
              className="h-12 w-12 shrink-0 bg-transparent"
            >
              {copied ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <Button onClick={onViewAuction} className="w-full h-12 rounded-full">
            <Eye className="w-5 h-5 mr-2" />
            {t("viewAuction")}
          </Button>
          <Button
            onClick={onShare}
            variant="outline"
            className="w-full h-12 rounded-full bg-transparent"
          >
            <Share2 className="w-5 h-5 mr-2" />
            {t("shareAuction")}
          </Button>
          <Button
            onClick={onGoToHome}
            variant="ghost"
            className="w-full h-12 rounded-full"
          >
            <Home className="w-5 h-5 mr-2" />
            {t("backHome")}
          </Button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>{t("nextSteps")}</strong> {t("nextStepsDesc")}
          </p>
        </div>
      </Card>
    </div>
  );
}
