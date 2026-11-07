"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import {
  Bug,
  Download,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  SlidersHorizontal,
  Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LangToggle } from "@/components/ui/lang-toggle";
import { AccessSwitcher } from "@/components/layouts/AccessSwitcher";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FeedbackDialog, FeedbackLauncher } from "@/features/app/feedback/ui";
import { useFullscreen } from "@/lib/use-fullscreen";
import { usePwaInstaller } from "@/lib/pwa-install";
import { cn } from "@/lib/utils";

/**
 * Every utility control the header carries, in one place for all three shells.
 *
 * Below `md` they collapse into a single « Réglages rapides » popover — the
 * header used to line up bug, language, theme and bell beside the logo and the
 * access switcher, which left a phone with a row of eight small targets. From
 * `md` they sit inline as before, plus the two new ones: install the app, and
 * full screen.
 *
 * Install is hidden once the app runs installed; full screen is hidden where
 * the browser has no API (iPhone Safari), so neither is ever a dead button.
 */
function useToolboxActions() {
  const { isStandalone, showInstallDialog } = usePwaInstaller();
  const { isFullscreen, supported, toggle } = useFullscreen();
  return {
    canInstall: !isStandalone,
    showInstallDialog,
    canFullscreen: supported,
    isFullscreen,
    toggleFullscreen: toggle,
  };
}

const THEMES = [
  { id: "light", icon: Sun, key: "light" },
  { id: "dark", icon: Moon, key: "dark" },
  { id: "system", icon: Monitor, key: "system" },
] as const;

function Row({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-muted"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </button>
  );
}

export function HeaderToolbox({
  className,
  showAccess = false,
}: {
  className?: string;
  /** On a phone the access switch moves in here from the top bar. */
  showAccess?: boolean;
}) {
  const t = useTranslations("common.toolbox");
  const { theme, setTheme } = useTheme();
  const actions = useToolboxActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const fullscreenLabel = actions.isFullscreen ? t("exitFullscreen") : t("fullscreen");
  const FullscreenIcon = actions.isFullscreen ? Minimize2 : Maximize2;

  return (
    <>
      {/* From md: the controls inline. */}
      <div className={cn("hidden items-center gap-1 md:flex", className)}>
        <FeedbackLauncher />
        {actions.canInstall && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            aria-label={t("install")}
            title={t("install")}
            onClick={() => void actions.showInstallDialog()}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
        {actions.canFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            aria-label={fullscreenLabel}
            aria-pressed={actions.isFullscreen}
            title={fullscreenLabel}
            onClick={actions.toggleFullscreen}
          >
            <FullscreenIcon className="h-4 w-4" />
          </Button>
        )}
        <LangToggle className="mr-1" />
        <ThemeToggle />
      </div>

      {/* Below md: one button, one sheet of controls. */}
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-9 w-9 text-muted-foreground md:hidden", className)}
            aria-label={t("label")}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-64 space-y-3 rounded-2xl border-border/60 bg-popover/90 p-3 backdrop-blur-xl md:hidden"
        >
          {showAccess && (
            <div className="space-y-1.5">
              <p className="px-1 text-xs font-medium text-muted-foreground">{t("access")}</p>
              <AccessSwitcher />
            </div>
          )}
          <div className="space-y-1.5">
            <p className="px-1 text-xs font-medium text-muted-foreground">{t("language")}</p>
            <LangToggle className="w-full [&>button]:flex-1" />
          </div>
          <div className="space-y-1.5">
            <p className="px-1 text-xs font-medium text-muted-foreground">{t("theme")}</p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
              {THEMES.map(({ id, icon: Icon, key }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={theme === id}
                  onClick={() => setTheme(id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors",
                    theme === id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-0.5 border-t pt-2">
            {actions.canInstall && (
              <Row
                icon={Download}
                label={t("install")}
                onClick={() => {
                  setMenuOpen(false);
                  void actions.showInstallDialog();
                }}
              />
            )}
            {actions.canFullscreen && (
              <Row
                icon={FullscreenIcon}
                label={fullscreenLabel}
                onClick={() => {
                  setMenuOpen(false);
                  actions.toggleFullscreen();
                }}
              />
            )}
            <Row
              icon={Bug}
              label={t("feedback")}
              onClick={() => {
                setMenuOpen(false);
                setFeedbackOpen(true);
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
