import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface BubbleAvatarProps {
  /** Whoever wrote the bubble. */
  name?: string;
  src?: string;
}

/**
 * The small avatar beside someone else's bubble or offer card: their photo, or
 * their initial on the same gradient the thread header and the inbox row use.
 *
 * It was a hard-coded « ? » on a gradient ending in `accent-pink`, which is
 * not a colour this theme defines - so half of it was transparent.
 */
export function BubbleAvatar({ name, src }: BubbleAvatarProps) {
  const initial = name?.trim().charAt(0).toUpperCase() || "?";

  return (
    <Avatar className="w-8 h-8 shrink-0 flex-none">
      <AvatarImage src={src} alt={name ?? ""} />
      <AvatarFallback className="bg-linear-to-b from-blue-400 to-blue-600 dark:from-blue-600 dark:to-blue-950 text-white text-xs font-medium">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
