"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Star, Clock, MapPin, Package, TrendingUp } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";

interface Seller {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviews: number;
  joined: string;
  location: string;
  totalAuctions: number;
  activeAuctions: number;
}

interface SellerAuction {
  id: string;
  title: string;
  image: string;
  currentBid: number;
  bids: number;
  status: "active" | "ended" | "sold";
  endTime: string;
  category: string;
}

interface SellerProfileProps {
  sellerId: string;
}

export function SellerProfile({ sellerId }: SellerProfileProps) {
  // Mock seller data - will be replaced with API
  const seller: Seller = {
    id: sellerId,
    name: "Jean-Pierre",
    avatar: "https://github.com/shadcn.png",
    rating: 4.8,
    reviews: 124,
    joined: "2023",
    location: "Paris, France",
    totalAuctions: 45,
    activeAuctions: 8,
  };

  // Mock auction history - will be replaced with API
  const auctionHistory: SellerAuction[] = [
    {
      id: "1",
      title: "Road Bike - Trek FX 3",
      image:
        "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&q=80",
      currentBid: 210,
      bids: 13,
      status: "active",
      endTime: new Date("2025-12-10T12:00:00Z").toISOString(),
      category: "Sports & Outdoors",
    },
    {
      id: "2",
      title: "Vintage Furniture Set",
      image:
        "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",
      currentBid: 450,
      bids: 28,
      status: "active",
      endTime: new Date("2025-12-15T15:30:00Z").toISOString(),
      category: "Furniture",
    },
    {
      id: "3",
      title: "Designer Handbag Collection",
      image:
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80",
      currentBid: 320,
      bids: 15,
      status: "ended",
      endTime: new Date("2025-11-20T10:00:00Z").toISOString(),
      category: "Fashion",
    },
    {
      id: "4",
      title: "Electronics Bundle",
      image:
        "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&q=80",
      currentBid: 580,
      bids: 32,
      status: "sold",
      endTime: new Date("2025-11-15T09:00:00Z").toISOString(),
      category: "Electronics",
    },
  ];

  const activeAuctions = auctionHistory.filter((a) => a.status === "active");
  const pastAuctions = auctionHistory.filter((a) => a.status !== "active");

  return (
    <div className="  mx-auto p-4 md:p-6 pb-24 md:pb-6">
      {/* Seller Header */}
      <Card className="mb-6">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <Avatar className="w-24 h-24 md:w-32 md:h-32 border-4 border-background shadow-xl">
              <AvatarImage src={seller.avatar} />
              <AvatarFallback className="text-2xl font-bold bg-linear-to-br from-primary to-accent-pink text-white">
                {seller.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                <h1 className="text-2xl md:text-3xl font-bold">
                  {seller.name}
                </h1>
                <Badge variant="secondary" className="w-fit mx-auto md:mx-0">
                  Seller
                </Badge>
              </div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold text-lg">{seller.rating}</span>
                  <span className="text-muted-foreground">
                    ({seller.reviews} reviews)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{seller.location}</span>
                </div>
                <div className="text-muted-foreground">
                  Joined {seller.joined}
                </div>
              </div>
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {seller.totalAuctions}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Auctions
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {seller.activeAuctions}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Active Now
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auction History */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Auction History</h2>
        </div>

        {/* Active Auctions */}
        {activeAuctions.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Badge className="bg-green-500">Active</Badge>
              <span className="text-muted-foreground">
                {activeAuctions.length} auction
                {activeAuctions.length > 1 ? "s" : ""}
              </span>
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeAuctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} />
              ))}
            </div>
          </div>
        )}

        {/* Past Auctions */}
        {pastAuctions.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Badge variant="outline">Past</Badge>
              <span className="text-muted-foreground">
                {pastAuctions.length} auction
                {pastAuctions.length > 1 ? "s" : ""}
              </span>
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pastAuctions.map((auction) => (
                <AuctionCard key={auction.id} auction={auction} />
              ))}
            </div>
          </div>
        )}

        {auctionHistory.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No auction history available
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function AuctionCard({ auction }: { auction: SellerAuction }) {
  const isEnded = new Date(auction.endTime) < new Date();

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow group">
      <Link href={`/auction/${auction.id}`}>
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          <Image
            src={auction.image}
            alt={auction.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
          />
          <div className="absolute top-2 left-2">
            <Badge
              variant="secondary"
              className="backdrop-blur-md bg-background/80"
            >
              {auction.category}
            </Badge>
          </div>
          <div className="absolute top-2 right-2">
            <StatusBadge status={auction.status} />
          </div>
        </div>
      </Link>

      <CardHeader className="p-4 pb-2">
        <Link href={`/auction/${auction.id}`}>
          <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
            {auction.title}
          </h3>
        </Link>
        <div className="flex items-center text-sm text-muted-foreground gap-1 mt-1">
          <Clock className="w-3 h-3" />
          <span suppressHydrationWarning>
            {isEnded
              ? `Ended ${formatDistanceToNow(new Date(auction.endTime), { addSuffix: true })}`
              : `Ends ${formatDistanceToNow(new Date(auction.endTime), { addSuffix: true })}`}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xl font-bold text-primary">
                €{auction.currentBid}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {auction.bids} bid{auction.bids > 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: SellerAuction["status"] }) {
  const styles = {
    active: "bg-green-500 hover:bg-green-600",
    ended: "bg-gray-500 hover:bg-gray-600",
    sold: "bg-blue-500 hover:bg-blue-600",
  };

  const labels = {
    active: "Active",
    ended: "Ended",
    sold: "Sold",
  };

  return <Badge className={styles[status]}>{labels[status]}</Badge>;
}
