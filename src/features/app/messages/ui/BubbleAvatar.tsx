import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsOf } from "../lib/initials";

interface BubbleAvatarProps {
  /** Whoever wrote the bubble. */
  name?: string;
  /** Their two letters, when the caller knows the first and last name apart. */
  initials?: string;
  src?: string;
}

/**
 * The small avatar beside someone else's bubble or offer card: their photo, or
 * their initials on the same gradient the thread header and the inbox row use.
 *
 * It was a hard-coded « ? » on a gradient ending in `accent-pink`, which is
 * not a colour this theme defines - so half of it was transparent.
 */
export function BubbleAvatar({ name, initials, src }: BubbleAvatarProps) {
  const initial = initials || initialsOf({ name });

  return (
    <Avatar className="w-8 h-8 shrink-0 flex-none">
      <AvatarImage src={src} alt={name ?? ""} />
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
