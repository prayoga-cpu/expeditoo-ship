import { cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";
import { BubbleAvatar } from "./BubbleAvatar";

interface ChatBubbleProps {
  message: string;
  isOwn: boolean;
  timestamp: string;
  avatar?: string;
  /** The writer's name, for the avatar's initial. */
  name?: string;
  /** Their two letters, when known apart from `name`. */
  initials?: string;
  readByOther?: boolean;
  onDelete?: () => void;
}

export function ChatBubble({
  message,
  isOwn,
  timestamp,
  avatar,
  name,
  initials,
  readByOther,
}: ChatBubbleProps) {
  return (
    <div className={cn("flex gap-3 mb-4", isOwn && "flex-row-reverse")}>
      {!isOwn && <BubbleAvatar name={name} initials={initials} src={avatar} />}
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
