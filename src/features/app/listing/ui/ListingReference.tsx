"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ListingReferenceProps {
  reference: number;
  /**
   * Adds a button that copies the bare number. Detail pages only: on a list
   * the whole card is a link, and a button inside a link is not a button.
   */
  copyable?: boolean;
  className?: string;
}

/**
 * « Réf. 100042 » — the number a requester, a transporter, a driver and
 * support quote to each other for one job (listing_reference_spec.md §3).
 * One component, so every screen writes it the same way.
 *
 * What is copied is the number alone: it is what the board search, the admin
 * table and a support agent take, prefix or not.
 */
export function ListingReference({
  reference,
  copyable = false,
  className,
}: ListingReferenceProps) {
  const t = useTranslations("listingReference");
  const value = String(reference);

  const copy = async () => {
    try {
      // Throws, rather than being absent, on an insecure origin or when the
      // browser refuses — both land in the same toast.
      await navigator.clipboard.writeText(value);
      toast.success(t("copied", { reference: value }));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-xs tabular-nums text-muted-foreground",
        className
      )}
    >
      {t("label", { reference: value })}
      {copyable && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          onClick={copy}
          aria-label={t("copy")}
          title={t("copy")}
        >
          <Copy className="size-3.5" aria-hidden />
        </Button>
      )}
    </span>
  );
}
