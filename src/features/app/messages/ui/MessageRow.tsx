import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SwipeableItem } from "@/components/ui/swipeable-item";
import { cn } from "@/lib/utils";
import { Headset } from "lucide-react";
import type { Message } from "../types";

/**
 * Pure UI component for rendering a single message row
 * Supports swipe-to-delete gesture for conversation deletion
 *
 * @param message - Message data object
 * @param onDelete - Callback to delete the conversation
 * @param basePath - Base path for navigation (e.g., "/messages" or "/driver/messages")
 */
interface MessageRowProps {
  message: Message;
  onDelete?: (id: string) => void;
  basePath?: string;
}

export function MessageRow({
  message,
  onDelete,
  basePath = "/messages"
}: MessageRowProps) {
  const router = useRouter();

  const handleClick = (_e: React.MouseEvent) => {
    // Prevent navigation if the user was likely swiping/selecting text
    if (window.getSelection()?.toString().length) return;

    router.push(`${basePath}/${message.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className="block select-none" // prevent text selection
      draggable="false" // prevent native drag
    >
      <div className="group flex items-stretch border-b border-border transition-all duration-200 ease-out cursor-pointer overflow-hidden">
        {/* Left Static Part (Avatar) */}
        <div className="py-4 pr-3 shrink-0 flex items-start bg-background group-hover:bg-muted transition-colors duration-200">
          <Avatar className="w-12 h-12 shrink-0 pointer-events-none">
            {" "}
            {/* Disable pointer events on avatar image to prevent drag */}
            <AvatarImage src={message.avatar} alt={message.name} />
            <AvatarFallback className="bg-linear-to-b from-blue-400 to-blue-600 dark:from-blue-600 dark:to-blue-950 text-white">
              {message.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Right Swipeable Part (Content) */}
        <SwipeableItem
          onDelete={onDelete ? () => onDelete(message.id) : () => { }}
          // If no delete handler, disable swiping
          disabled={!onDelete}
          className="flex-1 min-w-0"
          // We need to set background here to cover the delete button,
          // and handle hover state manually since this element sits on top of the parent hover
          contentClassName="h-full flex gap-3 py-4 pl-0 bg-background group-hover:bg-muted transition-colors duration-200"
        >
          <div className="flex-1 min-w-0 pointer-events-none">
            {" "}
            {/* Ensure clicks go through to parent but disable inner element dragging */}
            <div className="flex justify-between items-start gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <h3
                  className={cn(
                    "font-bold truncate",
                    message.unread && "text-foreground"
                  )}
                >
                  {message.name}
                </h3>
                {message.type === "SUPPORT" && (
                  <Badge
                    variant="secondary"
                    className="shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs px-2 py-0"
                  >
                    <Headset className="w-3 h-3 mr-1" />
                    Support
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {message.timestamp}
              </span>
            </div>
            <p className="text-xs text-muted-foreground truncate mb-1">
              {message.listing}
            </p>
            <p
              className={cn(
                "text-sm truncate",
                message.unread
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {message.snippet}
            </p>
          </div>
          {message.unread && (
            <div className="w-3 h-3 rounded-full bg-primary shrink-0 mt-2" />
          )}
        </SwipeableItem>
      </div>
    </div>
  );
}
