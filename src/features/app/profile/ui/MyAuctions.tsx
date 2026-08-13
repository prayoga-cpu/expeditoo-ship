"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MoreVertical,
  Edit,
  Trash2,
  RefreshCw,
  Eye,
  Clock,
  Plus,
  Package,
  StopCircle,
  ArrowLeft,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageLoader } from "@/components/ui/page-loader";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { formatCurrency } from "@/lib/currency";
import { useTranslations, useLocale } from "next-intl";
import { fr, enUS } from "date-fns/locale";

interface Auction {
  id: string;
  title: string;
  image: string;
  currentBid: number;
  bids: number;
  status: "active" | "ended" | "sold" | "cancelled";
  endTime: Date;
  views: number;
}

import {
  fetchMyAuctions,
  endAuction,
  deleteAuction,
  repostAuction,
  type ApiAuction,
} from "../api";

// Adapter to match UI interface if needed, or update UI to use ApiAuction
function adaptAuction(item: ApiAuction): Auction {
  return {
    id: item.id,
    title: item.title,
    image: item.images?.[0]?.url || "/image-not-found.svg",
    currentBid: item.currentPrice || item.startPrice || 0,
    bids: item.bidCount || 0,
    status: item.status,
    endTime: new Date(item.endsAt || Date.now()),
    views: item.views || 0,
  };
}

// Wrapper for React Query to adapt data
async function getAuctions() {
  const data = await fetchMyAuctions();
  return data.map(adaptAuction);
}

export function MyAuctions() {
  const t = useTranslations("profile.myAuctions");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enUS;

  const [activeTab, setActiveTab] = useState("active");
  const queryClient = useQueryClient();
  const searchParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const showBackButton = searchParams.get("from") === "profile";

  // TanStack Query with caching
  const { data: auctions = [], isLoading } = useQuery({
    queryKey: ["my-auctions"],
    queryFn: getAuctions,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  // Mutations
  const endMutation = useMutation({
    mutationFn: endAuction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-auctions"] });
      toast.success(t("toast.endSuccess"));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAuction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-auctions"] });
      toast.success(t("toast.deleteSuccess"));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const repostMutation = useMutation({
    mutationFn: ({ id, duration }: { id: string; duration: string }) =>
      repostAuction(id, duration),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-auctions"] });
      toast.success(t("toast.repostSuccess"));
      setActiveTab("active");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const activeAuctions = auctions.filter((a) => a.status === "active");
  const pastAuctions = auctions.filter((a) => a.status !== "active");

  const counts = {
    active: activeAuctions.length,
    past: pastAuctions.length,
  };

  if (isLoading) {
    return <PageLoader variant="padded" />;
  }

  return (
    <Tabs
      defaultValue="active"
      value={activeTab}
      onValueChange={setActiveTab}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Link href="/profile">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
          )}
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <TabsList className="grid w-full grid-cols-2 md:w-auto">
            <TabsTrigger value="active" suppressHydrationWarning>
              {t("tabs.active")} ({counts.active})
            </TabsTrigger>
            <TabsTrigger value="past" suppressHydrationWarning>
              {t("tabs.past")} ({counts.past})
            </TabsTrigger>
          </TabsList>

          <Button asChild className="shrink-0">
            <Link href="/create">
              <Plus className="w-4 h-4 mr-2" />
              {t("newAuction")}
            </Link>
          </Button>
        </div>
      </div>

      {/* Content */}
      <TabsContent value="active" className="mt-0">
        {activeAuctions.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {activeAuctions.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                onEnd={() => endMutation.mutate(auction.id)}
                onRepost={(duration) =>
                  repostMutation.mutate({ id: auction.id, duration })
                }
                onDelete={() => deleteMutation.mutate(auction.id)}
                isLoading={
                  endMutation.isPending ||
                  deleteMutation.isPending ||
                  repostMutation.isPending
                }
                dateLocale={dateLocale}
              />
            ))}
          </div>
        ) : (
          <EmptyState type="active" />
        )}
      </TabsContent>

      <TabsContent value="past" className="mt-0">
        {pastAuctions.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pastAuctions.map((auction) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                onEnd={() => endMutation.mutate(auction.id)}
                onRepost={(duration) =>
                  repostMutation.mutate({ id: auction.id, duration })
                }
                onDelete={() => deleteMutation.mutate(auction.id)}
                isLoading={
                  endMutation.isPending ||
                  deleteMutation.isPending ||
                  repostMutation.isPending
                }
                dateLocale={dateLocale}
              />
            ))}
          </div>
        ) : (
          <EmptyState type="past" />
        )}
      </TabsContent>
    </Tabs>
  );
}

interface AuctionCardProps {
  auction: Auction;
  onEnd: () => void;
  onRepost: (duration: string) => void;
  onDelete: () => void;
  isLoading: boolean;
  dateLocale: any;
}

function AuctionCard({
  auction,
  onEnd,
  onRepost,
  onDelete,
  isLoading,
  dateLocale,
}: AuctionCardProps) {
  const t = useTranslations("profile.myAuctions.card");
  const router = useRouter();
  const isEnded = new Date(auction.endTime) < new Date();
  const isPast = auction.status !== "active";

  return (
    <div
      className="overflow-hidden group hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col h-full rounded-xl bg-card border border-border"
      onClick={() => router.push(`/listing/${auction.id}`)}
    >
      {/* Image with Overlay - Full bleed at top */}
      <div className="relative aspect-16/10 w-full overflow-hidden">
        <Image
          src={auction.image}
          alt={auction.title}
          fill
          className={`object-cover transition-transform duration-500 group-hover:scale-110 ${isPast ? "grayscale-50" : ""}`}
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />

        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <StatusBadge status={auction.status} />
        </div>

        {/* Actions Menu */}
        <div
          className="absolute top-3 right-3"
          onClick={(e) => e.stopPropagation()}
        >
          <AuctionActions
            auction={auction}
            onEnd={onEnd}
            onRepost={onRepost}
            onDelete={onDelete}
            isLoading={isLoading}
          />
        </div>

        {/* Title on image */}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="font-bold text-white text-base line-clamp-1 drop-shadow-md">
            {auction.title}
          </h3>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        {/* Auction Info Grid */}
        <div className="flex justify-between items-center gap-2 bg-muted/50 rounded-lg p-3">
          <div className="text-center flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
              {t("currentBid")}
            </p>
            <p className="font-bold text-lg text-blue-500">
              {formatCurrency(auction.currentBid)}
            </p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
              {t("bids")}
            </p>
            <p className="font-bold text-lg">{auction.bids}</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
              {t("views")}
            </p>
            <p className="font-bold text-lg">{auction.views}</p>
          </div>
        </div>

        {/* Time */}
        <div className="flex items-center justify-center mt-auto text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5 mr-1.5" />
          <span suppressHydrationWarning>
            {isEnded
              ? `${t("ended")} ${formatDistanceToNow(auction.endTime, { addSuffix: true, locale: dateLocale })}`
              : `${t("ends")} ${formatDistanceToNow(auction.endTime, { addSuffix: true, locale: dateLocale })}`}
          </span>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Auction["status"] }) {
  const styles = {
    active: "bg-green-500/90 backdrop-blur-sm",
    ended: "bg-gray-500/90 backdrop-blur-sm",
    sold: "bg-blue-500/90 backdrop-blur-sm",
    cancelled: "bg-red-500/90 backdrop-blur-sm",
  };

  return (
    <Badge
      className={`${styles[status]} text-white border-0 capitalize shadow-sm px-2 py-0.5 text-xs font-medium`}
    >
      {status}
    </Badge>
  );
}

interface AuctionActionsProps {
  auction: Auction;
  onEnd: () => void;
  onRepost: (duration: string) => void;
  onDelete: () => void;
  isLoading: boolean;
}

function AuctionActions({
  auction,
  onEnd,
  onRepost,
  onDelete,
  isLoading,
}: AuctionActionsProps) {
  const t = useTranslations("profile.myAuctions");
  const router = useRouter();
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRepostDialog, setShowRepostDialog] = useState(false);
  const [repostDuration, setRepostDuration] = useState("7");

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white hover:text-white hover:bg-white/20 backdrop-blur-sm"
            disabled={isLoading}
          >
            {isLoading ? (
              <LottieLoader width={20} height={20} />
            ) : (
              <MoreVertical className="w-4 h-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/listing/${auction.id}`}>
              <Eye className="w-4 h-4 mr-2" /> {t("actions.viewDetails")}
            </Link>
          </DropdownMenuItem>
          {auction.status === "active" ? (
            <>
              <DropdownMenuItem
                onClick={() => router.push(`/create?edit=${auction.id}`)}
              >
                <Edit className="w-4 h-4 mr-2" /> {t("actions.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setShowEndDialog(true)}
              >
                <StopCircle className="w-4 h-4 mr-2" /> {t("actions.end")}
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onClick={() => setShowRepostDialog(true)}>
                <RefreshCw className="w-4 h-4 mr-2" /> {t("actions.repost")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" /> {t("actions.delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* End Auction Dialog */}
      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dialogs.end.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dialogs.end.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dialogs.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onEnd();
                setShowEndDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("dialogs.end.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Auction Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("dialogs.delete.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("dialogs.delete.description", { title: auction.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dialogs.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("dialogs.delete.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Repost Auction Dialog */}
      <Dialog open={showRepostDialog} onOpenChange={setShowRepostDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogs.repost.title")}</DialogTitle>
            <DialogDescription>
              {t("dialogs.repost.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              {t("dialogs.repost.durationLabel")}
            </label>
            <Select value={repostDuration} onValueChange={setRepostDuration}>
              <SelectTrigger>
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t("dialogs.repost.durations.1")}</SelectItem>
                <SelectItem value="3">{t("dialogs.repost.durations.3")}</SelectItem>
                <SelectItem value="5">{t("dialogs.repost.durations.5")}</SelectItem>
                <SelectItem value="7">{t("dialogs.repost.durations.7")}</SelectItem>
                <SelectItem value="14">{t("dialogs.repost.durations.14")}</SelectItem>
                <SelectItem value="30">{t("dialogs.repost.durations.30")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRepostDialog(false)}
            >
              {t("dialogs.cancel")}
            </Button>
            <Button
              onClick={() => {
                onRepost(repostDuration);
                setShowRepostDialog(false);
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {t("dialogs.repost.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ type }: { type: "active" | "past" }) {
  const t = useTranslations("profile.myAuctions.empty");
  
  return (
    <div className="text-center py-12 border rounded-lg bg-muted/10 border-dashed">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Package className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium">
        {type === "active" ? t("noActive") : t("noPast")}
      </h3>
      <p className="text-muted-foreground mb-4">
        {type === "active" ? t("noActiveDesc") : t("noPastDesc")}
      </p>
      {type === "active" && (
        <Button asChild>
          <Link href="/create">{t("startSelling")}</Link>
        </Button>
      )}
    </div>
  );
}
