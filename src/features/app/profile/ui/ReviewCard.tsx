import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/RatingStars";
import { ThumbsUp, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useTranslations } from "next-intl";

interface ReviewCardProps {
  id: string;
  author: string;
  authorVerified?: boolean;
  authorImage?: string | null;
  rating: number;
  title: string;
  content: string;
  timestamp: string;
  helpful?: number;
  type?: "buyer" | "seller";
}

export function ReviewCard({
  id: _id,
  author,
  authorVerified,
  authorImage,
  rating,
  title,
  content,
  timestamp,
  helpful = 0,
  type,
}: ReviewCardProps) {
  const t = useTranslations("profile.reviews.card");

  return (
    <div className="border border-border rounded-xl p-4 md:p-6 hover:bg-muted/30 transition-all duration-200 ease-out">
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarImage src={authorImage || ""} />
          <AvatarFallback className="bg-gradient-to-b from-blue-400 to-blue-600 dark:from-blue-600 dark:to-blue-950 text-white text-sm">
            {author.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-bold text-foreground flex items-center gap-1">
              {author}
              {authorVerified && <VerifiedBadge size={14} />}
            </h3>
            {type && (
              <Badge variant="outline" className="text-xs">
                {type === "buyer" ? t("buyer") : t("seller")}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RatingStars rating={rating} size="sm" />
            <span>•</span>
            <span>{timestamp}</span>
          </div>
        </div>
      </div>

      <h4 className="font-bold text-foreground mb-2">{title}</h4>
      <p className="text-sm text-foreground mb-4 leading-relaxed">{content}</p>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="gap-2 text-xs h-8 px-2">
          <ThumbsUp className="w-4 h-4" />
          {t("helpful")} ({helpful})
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-xs h-8 px-2 text-muted-foreground hover:text-destructive"
          onClick={() => {
            // TODO: Implement report review API
            console.log("Report review:", _id);
          }}
        >
          <Flag className="w-4 h-4" />
          {t("report")}
        </Button>
      </div>
    </div>
  );
}
