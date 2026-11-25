import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SwipeableItem } from "@/components/ui/swipeable-item";
import { cn } from "@/lib/utils";
import { Headset } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Message } from "../types";
import { jobLine } from "../lib/job-summary";
import { initialsOf } from "../lib/initials";
import { RowDeleteButton } from "./RowDeleteButton";

/**
 * Pure UI component for rendering a single message row
 * Supports swipe-to-delete gesture for conversation deletion, and the same
 * deletion from a button a mouse or a keyboard can reach (`RowDeleteButton`)
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
  const t = useTranslations("messages.item");
  // « Paris → Lyon · 20 nov. – 22 nov. »: which job, readable from the list.
  const job = jobLine(message.route, message.dates);

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
        <div className="py-3 pr-3 shrink-0 flex items-start bg-background group-hover:bg-muted transition-colors duration-200">
          <Avatar className="w-12 h-12 shrink-0 pointer-events-none">
            {" "}
            {/* Disable pointer events on avatar image to prevent drag */}
            <AvatarImage src={message.avatar} alt={message.name} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {message.initials ?? initialsOf({ name: message.name })}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Right Swipeable Part (Content) */}
        <SwipeableItem
          onDelete={onDelete ? () => onDelete(message.id) : () => { }}
          deleteLabel={t("delete")}
          // If no delete handler, disable swiping
          disabled={!onDelete}
          className="flex-1 min-w-0"
          // We need to set background here to cover the delete button,
          // and handle hover state manually since this element sits on top of the parent hover
          contentClassName="h-full flex gap-3 py-3 pl-0 bg-background group-hover:bg-muted transition-colors duration-200"
        >
          <div className="flex-1 min-w-0 pointer-events-none">
            {" "}
            {/* Ensure clicks go through to parent but disable inner element dragging */}
            {/* Three lines at most (client feedback 2026-11-19, #32): who and
                when / the job and the last message / its towns and dates. The
                snippet used to take a fourth line of its own. */}
            <div className="flex items-baseline justify-between gap-2">
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
                    className="shrink-0 tone-info text-xs px-2 py-0"
                  >
                    <Headset className="w-3 h-3 mr-1" />
                    {t("support")}
                  </Badge>
                )}
              </div>
              <span
                className={cn(
                  "text-xs shrink-0",
                  message.unread
                    ? "font-semibold text-primary"
                    : "text-muted-foreground"
                )}
              >
                {message.timestamp}
              </span>
            </div>
            <p className="flex items-baseline gap-1.5 min-w-0 text-sm">
              <span
                className={cn(
                  "truncate text-xs",
                  message.snippet ? "shrink-0 max-w-[50%]" : "min-w-0",
                  job ? "font-medium text-foreground/80" : "text-muted-foreground"
                )}
              >
                {message.listing}
              </span>
              {message.snippet && (
                <>
                  <span aria-hidden className="shrink-0 text-xs text-muted-foreground">
                    ·
                  </span>
                  <span
                    data-testid="row-snippet"
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      message.unread
                        ? "font-semibold text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {message.snippet}
                  </span>
                </>
              )}
            </p>
            {job && (
              <p className="text-xs text-muted-foreground truncate">
                {job}
              </p>
            )}
          </div>
          {message.unread && (
            <div className="w-3 h-3 rounded-full bg-primary shrink-0 mt-2" />
          )}
        </SwipeableItem>
        {onDelete && (
          <div className="hidden md:flex items-center bg-background pl-2 group-hover:bg-muted transition-colors duration-200">
            <RowDeleteButton
              name={message.name}
              onDelete={() => onDelete(message.id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
