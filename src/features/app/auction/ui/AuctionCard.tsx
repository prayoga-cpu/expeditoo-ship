"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, TrendingUp, Gavel } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AuctionCardProps {
  id: string;
  title: string;
  image?: string;
  currentBid: number;
  bidCount: number;
  timeRemaining: string;
  status: "active" | "closed";
}

export function AuctionCard({
  id,
  title,
  image,
  currentBid,
  bidCount,
  timeRemaining,
  status,
}: AuctionCardProps) {
  const router = useRouter();

  return (
    <div className="relative bg-card rounded-lg overflow-hidden card-shadow border border-border hover:shadow-lg transition-all duration-200 cursor-pointer group">
      {image && (
        <div
          className="w-full h-40 bg-linear-to-br from-primary to-accent-pink"
          style={{
            backgroundImage: `url('${image}')`,
            backgroundSize: "cover",
          }}
        />
      )}
      <div className="p-4 flex flex-col">
        <h3 className="font-semibold text-foreground truncate mb-3 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <div className="space-y-3 flex-1">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="font-bold text-lg text-primary">
                €{currentBid}
              </span>
            </div>
            <Badge variant="outline" className="text-xs">
              {bidCount} bids
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            {timeRemaining}
          </div>
          <Badge
            className={
              status === "active"
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }
          >
            {status === "active" ? "Active" : "Ended"}
          </Badge>
        </div>

        {/* CTA Button - Only show for active auctions */}
        {status === "active" && (
          <div className="mt-4 pt-3 border-t border-border/50 relative z-10">
            <Button
              className="w-full font-semibold"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/auction/${id}`);
              }}
            >
              <Gavel className="w-4 h-4 mr-2" />
              Place Bid
            </Button>
          </div>
        )}
      </div>

      {/* Clickable overlay for card - redirects to detail page (except on button) */}
      <Link
        href={`/auction/${id}`}
        className="absolute inset-0 z-0"
        aria-label={`View ${title} details`}
        onClick={(e) => {
          // Don't navigate if clicking on button
          const target = e.target as HTMLElement;
          if (target.closest("button")) {
            e.preventDefault();
          }
        }}
      />
    </div>
  );
}
