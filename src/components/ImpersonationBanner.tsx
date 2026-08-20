"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { Eye } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useStopImpersonating } from "@/features/app/admin/hooks/useUserModeration";
import { useTranslations } from "next-intl";

/**
 * Visible on every surface while an admin is inside somebody else's session.
 *
 * It has to be unmissable: actions taken here are recorded as that user's
 * actions, so the one thing worse than not having impersonation is forgetting
 * you are using it.
 */
export function ImpersonationBanner() {
  const { session, user } = useAuth();
  const stopImpersonating = useStopImpersonating();
  const t = useTranslations("impersonation");

  const impersonatedBy = (
    session as { impersonatedBy?: string | null } | null
  )?.impersonatedBy;
  const expiresAt = session?.expiresAt;

  const [remaining, setRemaining] = useState<string>("");
  const stopping = useRef(false);

  // Back to the admin's own cookie. Everything cached on screen belongs to the
  // borrowed identity, so reload rather than try to reconcile it.
  const stop = useCallback(() => {
    if (stopping.current) return;
    stopping.current = true;

    stopImpersonating.mutate(undefined, {
      onSettled: () => window.location.assign("/admin/users"),
    });
  }, [stopImpersonating]);

  useEffect(() => {
    if (!impersonatedBy || !expiresAt) return;

    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      const total = Math.max(0, Math.floor(ms / 1000));
      const minutes = Math.floor(total / 60);
      const seconds = total % 60;
      setRemaining(`${minutes}:${String(seconds).padStart(2, "0")}`);

      // The borrowed session dies on its own at the hour. Left alone, the next
      // click lands on the sign-in screen even though the admin's own session
      // is still alive -- so hand it back the moment the clock runs out.
      if (total === 0) stop();
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [impersonatedBy, expiresAt, stop]);

  if (!impersonatedBy) return null;

  // Above the bottom nav on small screens, at the very bottom from xl up.
  // Anchoring it to the top would have hidden the app's sticky header, which
  // is the one piece of chrome an admin needs to get back out.
  return (
    <div className="fixed inset-x-0 bottom-[88px] xl:bottom-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-amber-500 bg-amber-400 px-4 py-2 text-sm text-amber-950 shadow-lg xl:pb-[calc(0.5rem+env(safe-area-inset-bottom))] dark:bg-amber-500">
      <Eye className="h-4 w-4 shrink-0" />
      <span className="font-semibold">{t("viewingAs")}</span>
      <span className="truncate max-w-[40vw]">{user?.name || user?.email}</span>
      {remaining && (
        <span className="font-mono tabular-nums">
          {t("endsIn", { time: remaining })}
        </span>
      )}
      <Button
        size="sm"
        variant="secondary"
        className="h-7 bg-amber-950 text-amber-50 hover:bg-amber-900"
        disabled={stopImpersonating.isPending}
        onClick={stop}
      >
        {stopImpersonating.isPending ? (
          <LottieLoader width={16} height={16} />
        ) : (
          t("stop")
        )}
      </Button>
    </div>
  );
}
