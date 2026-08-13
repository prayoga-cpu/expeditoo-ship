import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatBubbleProps {
  message: string;
  isOwn: boolean;
  timestamp: string;
  avatar?: string;
  readByOther?: boolean;
  onDelete?: () => void;
}

export function ChatBubble({
  message,
  isOwn,
  timestamp,
  avatar,
  readByOther,
}: ChatBubbleProps) {
  return (
    <div className={cn("flex gap-3 mb-4", isOwn && "flex-row-reverse")}>
      {!isOwn && (
        <Avatar className="w-8 h-8 shrink-0 flex-none">
          <AvatarImage src={avatar} />
          <AvatarFallback className="bg-linear-to-br from-primary to-accent-pink text-white text-[10px]">
            ?
          </AvatarFallback>
        </Avatar>
      )}
      <div className={cn("flex flex-col max-w-xs", isOwn && "items-end")}>
        <div
          className={cn(
            "rounded-2xl overflow-hidden px-4 py-2",
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-none"
              : "bg-muted text-foreground rounded-bl-none"
          )}
        >
          <p>{message}</p>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-xs text-muted-foreground">{timestamp}</span>
          {isOwn && (
            <span className="text-muted-foreground">
              {readByOther ? (
                <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
