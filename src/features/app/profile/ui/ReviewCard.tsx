import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/RatingStars";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useTranslations } from "next-intl";
import type { ReviewType } from "../types";

interface ReviewCardProps {
  id: string;
  author: string;
  authorVerified?: boolean;
  authorImage?: string | null;
  rating: number;
  title: string;
  content: string;
  timestamp: string;
  /** The side the reviewed person was on — see `ReviewType`. */
  type?: ReviewType;
}

/**
 * One review. It used to end on « Utile (0) » and « Signaler »: the first had
 * no handler and the second logged to the console — no endpoint counts a
 * helpful vote or takes a report (2.95.0). A review that should not be there
 * is reported through support, and an admin can delete it.
 */
export function ReviewCard({
  author,
  authorVerified,
  authorImage,
  rating,
  title,
  content,
  timestamp,
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
                {type === "requester" ? t("asRequester") : t("asCarrier")}
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

      {title && <h4 className="font-bold text-foreground mb-2">{title}</h4>}
      {content && (
        <p className="text-sm text-foreground leading-relaxed">{content}</p>
      )}
    </div>
  );
}
