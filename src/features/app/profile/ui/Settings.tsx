"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Globe, Bell, Trash2, ArrowLeft, SunMoon } from "lucide-react";

import Link from "next/link";
import { useSettings } from "../hooks/useSettings";
import { useTranslations } from "next-intl";
import { useLocale } from "@/components/providers/LocaleProvider";
import { locales, localeNames } from "@/i18n/config";
import { FlagComponents } from "@/components/ui/flags";

/**
 * One checkbox row inside a notification category box — a channel that
 * category actually has a preference key for. Reused across categories
 * rather than one-off per channel, since a category can carry up to two of
 * these (see notification_channel_settings_spec.md §2).
 */
function NotificationChannelRow({
  id,
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center gap-3 py-2 first:pt-0 last:pb-0 cursor-pointer"
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={
          onCheckedChange
            ? (value) => onCheckedChange(value as boolean)
            : undefined
        }
      />
      <span className="text-sm text-foreground">{label}</span>
    </label>
  );
}

/** A category box: title, description, then its channel rows. */
function NotificationCategory({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-foreground font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mb-1">{description}</p>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

export function Settings() {
  const {
    theme,
    email,
    inApp,
    isError,
    handleThemeChange,
    handleNotificationChange,
  } = useSettings();

  const t = useTranslations("settings");
  const { locale, setLocale } = useLocale();

  return (
    <div className="w-full   mx-auto p-4 md:p-6 pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/profile">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          {t("title")}
        </h1>
      </div>

      <div className="bg-card rounded-xl p-5 border border-border mb-8">
        <h2 className="font-semibold text-foreground mb-5 flex items-center gap-2">
          <SunMoon className="w-5 h-5 text-primary" />
          {t("theme.title")}
        </h2>
        <div className="space-y-3">
          <div className="space-y-3">
            {[
              { code: "light", label: t("theme.light") },
              { code: "dark", label: t("theme.dark") },
              { code: "system", label: t("theme.system") },
            ].map((themeOption) => (
              <label
                key={themeOption.code}
                className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <input
                  type="radio"
                  name="theme"
                  value={themeOption.code}
                  checked={theme === themeOption.code}
                  onChange={(e) => handleThemeChange(e.target.value)}
                  className="w-4 h-4 cursor-pointer accent-primary"
                />
                <span className="text-foreground font-medium">
                  {themeOption.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="bg-card rounded-xl p-5 border border-border mb-5">
        <h2 className="font-semibold text-foreground mb-5 flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          {t("language.title")}
        </h2>
        <div className="space-y-3">
          {locales.map((loc) => {
            const FlagIcon = FlagComponents[loc];
            return (
              <label
                key={loc}
                className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <input
                  type="radio"
                  name="language"
                  value={loc}
                  checked={locale === loc}
                  onChange={() => setLocale(loc)}
                  className="w-4 h-4 cursor-pointer accent-primary"
                />
                <span className="text-foreground font-medium flex items-center gap-2">
                  <FlagIcon className="w-6 h-4 rounded-sm shadow-sm" />
                  {localeNames[loc]}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-card rounded-xl p-5 border border-border mb-5">
        <h2 className="font-semibold text-foreground mb-5 flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          {t("notifications.title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("notifications.description")}
        </p>
        {isError ? (
          <p className="text-sm text-destructive">
            {t("notifications.loadError")}
          </p>
        ) : (
          <div className="space-y-3">
            <NotificationCategory
              title={t("notifications.listingPublished.title")}
              description={t("notifications.listingPublished.description")}
            >
              <NotificationChannelRow
                id="notif-listing-published-email"
                label={t("notifications.channels.email")}
                checked={email?.listingPublished ?? true}
                onCheckedChange={(checked) =>
                  handleNotificationChange("email", "listingPublished", checked)
                }
              />
            </NotificationCategory>

            <NotificationCategory
              title={t("notifications.driverPayment.title")}
              description={t("notifications.driverPayment.description")}
            >
              <NotificationChannelRow
                id="notif-driver-payment-email"
                label={t("notifications.channels.email")}
                checked={email?.invoiceReady ?? true}
                onCheckedChange={(checked) =>
                  handleNotificationChange("email", "invoiceReady", checked)
                }
              />
            </NotificationCategory>

            <NotificationCategory
              title={t("notifications.tripUpdates.title")}
              description={t("notifications.tripUpdates.description")}
            >
              <NotificationChannelRow
                id="notif-trip-updates-email"
                label={t("notifications.channels.email")}
                checked={email?.shipmentUpdates ?? true}
                onCheckedChange={(checked) =>
                  handleNotificationChange("email", "shipmentUpdates", checked)
                }
              />
              <NotificationChannelRow
                id="notif-trip-updates-push"
                label={t("notifications.channels.push")}
                checked={inApp?.shipmentUpdates ?? true}
                onCheckedChange={(checked) =>
                  handleNotificationChange("inApp", "shipmentUpdates", checked)
                }
              />
            </NotificationCategory>

            <NotificationCategory
              title={t("notifications.routeAlerts.title")}
              description={t("notifications.routeAlerts.description")}
            >
              <NotificationChannelRow
                id="notif-route-alerts-push"
                label={t("notifications.channels.push")}
                checked={inApp?.carrierRouteMatch ?? true}
                onCheckedChange={(checked) =>
                  handleNotificationChange("inApp", "carrierRouteMatch", checked)
                }
              />
            </NotificationCategory>

            <NotificationCategory
              title={t("notifications.accountSecurity.title")}
              description={t("notifications.accountSecurity.description")}
            >
              <NotificationChannelRow
                id="notif-account-email"
                label={t("notifications.channels.email")}
                checked
                disabled
              />
            </NotificationCategory>
          </div>
        )}
      </div>

      <div className="bg-accent-red/8 border border-accent-red/20 rounded-xl p-5">
        <h2 className="font-semibold text-accent-red mb-5 flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          {t("dangerZone.title")}
        </h2>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="w-full rounded-lg font-medium"
            >
              {t("dangerZone.deleteAccount")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-xl">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("dangerZone.deleteDialog.title")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("dangerZone.deleteDialog.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex gap-3 justify-end">
              <AlertDialogCancel className="rounded-lg">
                {t("dangerZone.deleteDialog.cancel")}
              </AlertDialogCancel>
              <AlertDialogAction className="rounded-lg bg-destructive hover:bg-destructive/90">
                {t("dangerZone.deleteDialog.delete")}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
