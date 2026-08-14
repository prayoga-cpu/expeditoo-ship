"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  BadgeCheck,
  CircleCheck,
  CircleX,
  Clock,
  Send,
  ShieldAlert,
  Truck,
} from "lucide-react";
import { REQUIRED_DOCUMENT_KINDS } from "@/lib/carrier-constants";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import {
  useCarrierApplication,
  useSubmitApplication,
  useWithdrawApplication,
} from "../hooks/useCarrier";
import type { CarrierApplication } from "../api/carrier.api";
import { BankingSection } from "./BankingSection";
import { CarrierProfileForm } from "./CarrierProfileForm";
import { DocumentChecklist } from "./DocumentChecklist";

/** The whole onboarding funnel on one screen, switched by application status. */
export function CarrierApplicationScreen() {
  const { data: application, isLoading } = useCarrierApplication();
  const t = useTranslations("carrier.application");

  if (isLoading) return <PageLoader />;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {!application ? (
        <CarrierProfileForm application={null} />
      ) : (
        <ApplicationFunnel application={application} />
      )}
    </div>
  );
}

function ApplicationFunnel({ application }: { application: CarrierApplication }) {
  const { status } = application;
  const editable = status === "draft" || status === "rejected";
  const locked = status === "submitted" || status === "under_review";

  return (
    <div className="space-y-6">
      <StatusBanner application={application} />

      {editable ? (
        <CarrierProfileForm application={application} />
      ) : (
        <ApplicationSummary application={application} />
      )}

      <DocumentChecklist documents={application.documents} canUpload={!locked} />

      {editable && <BankingSection application={application} />}

      {editable && <SubmitSection application={application} />}
      {status === "submitted" && <WithdrawSection />}
      {status === "approved" && <ApprovedActions />}
    </div>
  );
}

function StatusBanner({ application }: { application: CarrierApplication }) {
  const t = useTranslations("carrier.application.banner");
  const { status } = application;

  if (status === "draft") return null;

  const failed = status === "rejected" || status === "suspended";
  const reason =
    status === "rejected"
      ? application.rejectionReason
      : status === "suspended"
        ? application.suspensionReason
        : null;

  return (
    <Alert variant={failed ? "destructive" : "default"}>
      {status === "approved" ? (
        <BadgeCheck />
      ) : failed ? (
        <ShieldAlert />
      ) : (
        <Clock />
      )}
      <AlertTitle>{t(`${status}.title`)}</AlertTitle>
      <AlertDescription>
        <p>{t(`${status}.description`)}</p>
        {reason && (
          <p>
            {t("reasonLabel")}: {reason}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}

function ApplicationSummary({ application }: { application: CarrierApplication }) {
  const t = useTranslations("carrier.application.summary");

  const rows: [string, string][] = [
    [t("company"), application.companyName],
    [t("siret"), application.siret],
    [t("phone"), application.contactPhone],
    [
      t("address"),
      `${application.addressLine}, ${application.postalCode} ${application.city}`,
    ],
  ];

  return (
    <Card className="p-4 sm:p-6">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Mirrors the server's submission gate so gaps show before the round-trip. */
function SubmitSection({ application }: { application: CarrierApplication }) {
  const t = useTranslations("carrier.application.checklist");
  const submit = useSubmitApplication();

  const present = new Set(application.documents.map((doc) => doc.kind));
  const items: { label: string; done: boolean }[] = [
    {
      label: t("documents"),
      done: REQUIRED_DOCUMENT_KINDS.every((kind) => present.has(kind)),
    },
    {
      label: t("banking"),
      done: Boolean(application.ibanLast4 && application.bicLast4),
    },
    { label: t("vehicle"), done: application.vehicles.length > 0 },
  ];

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <h2 className="font-semibold">{t("title")}</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            {item.done ? (
              <CircleCheck className="h-4 w-4 shrink-0 text-success" />
            ) : (
              <CircleX className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className={item.done ? "" : "text-muted-foreground"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" asChild>
          <Link href="/carrier/fleet">
            <Truck className="mr-1.5 h-4 w-4" />
            {t("goToFleet")}
          </Link>
        </Button>
        <Button
          disabled={submit.isPending || items.some((item) => !item.done)}
          onClick={() => submit.mutate()}
        >
          <Send className="mr-1.5 h-4 w-4" />
          {submit.isPending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </Card>
  );
}

function WithdrawSection() {
  const t = useTranslations("carrier.application");
  const withdraw = useWithdrawApplication();

  return (
    <div className="flex justify-end">
      <Button
        variant="outline"
        disabled={withdraw.isPending}
        onClick={() => withdraw.mutate()}
      >
        {withdraw.isPending ? t("withdrawing") : t("withdraw")}
      </Button>
    </div>
  );
}

function ApprovedActions() {
  const t = useTranslations("carrier.application");

  return (
    <div className="flex justify-end">
      <Button asChild>
        <Link href="/carrier/fleet">
          <Truck className="mr-1.5 h-4 w-4" />
          {t("manageFleet")}
        </Link>
      </Button>
    </div>
  );
}
