"use client";

import { useTranslations } from "next-intl";
import { ArrowRight, FileText, SearchCheck, Truck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApplicationNav } from "@/lib/use-application-nav";
import { useCarrierApplication } from "../hooks/useCarrier";
import type { CarrierApplication } from "../api/carrier.api";
import { ApplicationStatusBanner } from "./ApplicationStatusBanner";

const STEPS = [
  { key: "details", icon: UserRound },
  { key: "documents", icon: FileText },
  { key: "review", icon: SearchCheck },
] as const;

/**
 * What becoming a driver involves, before the form — or, once an
 * application exists, where it stands (become_driver_spec.md §4).
 *
 * Opened from the access switcher's « Devenir chauffeur » row and from the
 * sidebar and mobile bar entries. It grants nothing and writes nothing: the
 * `carrier` and `driver` roles only ever come from an admin approving the
 * application (`enrolAsOwnDriver`), so its one button leads to the form,
 * through `useApplicationNav`, which leaves Admin mode on the way so the
 * page is not bounced back to the panel.
 */
export function DriverOnboardingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("carrier.onboarding");
  const { data: application } = useCarrierApplication({ enabled: open });
  const goToApplication = useApplicationNav();

  const proceed = () => {
    onOpenChange(false);
    goToApplication();
  };

  const primary = !application
    ? t("start")
    : application.status === "draft"
      ? t("finish")
      : t("open");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-success/15 text-success sm:mx-0">
            <Truck className="h-6 w-6" />
          </span>
          <DialogTitle>{application ? t("statusTitle") : t("title")}</DialogTitle>
          <DialogDescription>
            {application ? t("statusDescription") : t("description")}
          </DialogDescription>
        </DialogHeader>

        {application ? <Status application={application} /> : <Steps />}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("later")}
          </Button>
          <Button onClick={proceed}>
            {primary}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Steps() {
  const t = useTranslations("carrier.onboarding");

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {STEPS.map(({ key, icon: Icon }, index) => (
          <li key={key} className="flex gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {index + 1}. {t(`steps.${key}.title`)}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(`steps.${key}.body`)}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        {t("keepUser")}
      </p>
    </div>
  );
}

/** A draft is not a status anyone is waiting on, so the banner says nothing
 * for it (ApplicationStatusBanner) — the dialog says what is left to do. */
function Status({ application }: { application: CarrierApplication }) {
  const t = useTranslations("carrier.onboarding");

  if (application.status === "draft") {
    return <p className="text-sm text-muted-foreground">{t("draftBody")}</p>;
  }

  return <ApplicationStatusBanner application={application} />;
}
