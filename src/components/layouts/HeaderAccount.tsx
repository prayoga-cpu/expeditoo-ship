"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

/**
 * Up to two letters for the avatar: the first of each of the first two words
 * of the name, or the email's first letter when there is no name.
 */
export function initialsOf(
  name: string | null | undefined,
  email: string | null | undefined
): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    return words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("");
  }
  return (email ?? "").trim().charAt(0).toUpperCase();
}

interface HeaderAccountProps {
  /** The shell's own profile page: `/profile`, `/admin/profile`, `/driver/profile`. */
  profileHref: string;
  className?: string;
}

/**
 * Who is signed in, top right, in every shell (request_summary_spec.md §4).
 *
 * Nothing in the chrome said whose session this was, and the client asked for
 * the name there. Signup asks for one "Nom complet", so `user.name` already
 * holds first and last name.
 *
 * The name shows from `md` up. Below it only the avatar does, because the
 * mobile header row is already full; the link keeps the full name as its
 * accessible name at every width.
 */
export function HeaderAccount({ profileHref, className }: HeaderAccountProps) {
  const t = useTranslations("common.header");
  const { user, isLoading } = useAuth();

  // Nothing while the session resolves, for the same reason as
  // `HeaderQuickActions`: a control that appears a beat after the header
  // paints shoves its neighbours sideways under the cursor.
  if (isLoading || !user) return null;

  const name = user.name?.trim() || user.email;

  return (
    <Link
      href={profileHref}
      aria-label={name}
      title={t("profile")}
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-2 rounded-lg p-1 text-sm font-medium text-foreground transition-colors hover:bg-muted md:pr-2",
        className
      )}
    >
      <Avatar className="size-7">
        {user.image ? <AvatarImage src={user.image} alt="" /> : null}
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {initialsOf(user.name, user.email)}
        </AvatarFallback>
      </Avatar>
      <span className="hidden max-w-40 truncate md:inline">{name}</span>
    </Link>
  );
}
