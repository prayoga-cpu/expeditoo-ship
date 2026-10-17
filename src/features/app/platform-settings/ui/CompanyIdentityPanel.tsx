"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Building2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import {
  COMPANY_FIELDS,
  type CompanyField,
  type CompanyIdentity,
} from "../api/platform-settings.api";
import {
  useCompanyIdentity,
  useUpdateCompanyIdentity,
} from "../hooks/useLaunchReadiness";

type FormValues = Record<CompanyField, string>;

/**
 * Where the site runs. A fact about this deployment rather than a registration
 * number, so it is offered as the starting value of an empty field — the admin
 * still saves it, and can change it.
 */
export const DEFAULT_HOST =
  "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis";

const WIDE: CompanyField[] = ["address", "host"];

/** Server refusals arrive as codes on the field they name. */
const KNOWN_ERRORS = [
  "SIRET_14_DIGITS",
  "VAT_NUMBER_FORMAT",
  "VAT_RATE_RANGE",
  "EMAIL_FORMAT",
] as const;

function toForm(data: CompanyIdentity): FormValues {
  const form = {} as FormValues;
  for (const field of COMPANY_FIELDS) {
    form[field] = data.values[field] ?? (field === "host" ? DEFAULT_HOST : "");
  }
  return form;
}

function fieldErrors(error: unknown): Partial<Record<CompanyField, string>> {
  if (!(error instanceof ApiError) || !error.issues) return {};
  const errors: Partial<Record<CompanyField, string>> = {};
  for (const issue of error.issues) {
    const field = COMPANY_FIELDS.find((f) => f === issue.path);
    if (field) errors[field] = issue.message;
  }
  return errors;
}

/**
 * The company's legal identity, typed once by the client instead of handed to
 * a developer as deployment variables (launch_readiness_spec.md §A). It is
 * what turns every payment document from a « reçu » into a « facture », and
 * what fills the mentions légales.
 */
export function CompanyIdentityPanel() {
  const t = useTranslations("platformSettings.company");
  const format = useFormatter();
  const { data, isLoading, isError, refetch, isRefetching } = useCompanyIdentity();
  const update = useUpdateCompanyIdentity();
  const [form, setForm] = useState<FormValues | null>(null);
  const [errors, setErrors] = useState<Partial<Record<CompanyField, string>>>({});

  useEffect(() => {
    if (data) setForm(toForm(data));
  }, [data]);

  if (isLoading || (!form && !isError)) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  if (isError || !data || !form) {
    return (
      <Card className="p-5">
        <CenteredEmptyState
          icon={Building2}
          title={t("loadFailed")}
          description={t("loadFailedHint")}
        >
          <Button
            type="button"
            variant="outline"
            disabled={isRefetching}
            onClick={() => refetch()}
          >
            <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
            {t("retry")}
          </Button>
        </CenteredEmptyState>
      </Card>
    );
  }

  const handleSave = () => {
    setErrors({});
    update.mutate(form, {
      onSuccess: () => toast.success(t("saved")),
      onError: (error) => {
        setErrors(fieldErrors(error));
        toast.error(t("saveFailed"));
      },
    });
  };

  const errorText = (code: string) =>
    (KNOWN_ERRORS as readonly string[]).includes(code)
      ? t(`errors.${code}`)
      : t("errors.invalid");

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg border p-3 text-sm",
          data.documentType === "invoice"
            ? "border-success/30 bg-success/10"
            : "border-warning/30 bg-warning/10"
        )}
      >
        {data.documentType === "invoice" ? (
          t("status.invoice")
        ) : (
          <>
            <p>{t("status.receipt")}</p>
            <p className="mt-1 text-muted-foreground">
              {t("status.missing", {
                fields: data.missing.map((f) => t(`fields.${f}.label`)).join(", "),
              })}
            </p>
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {COMPANY_FIELDS.map((field) => {
          const id = `company-${field}`;
          const wide = WIDE.includes(field);
          const Control = wide ? Textarea : Input;
          return (
            <div key={field} className={cn("space-y-1.5", wide && "sm:col-span-2")}>
              <Label htmlFor={id}>{t(`fields.${field}.label`)}</Label>
              <Control
                id={id}
                value={form[field]}
                placeholder={t(`fields.${field}.placeholder`)}
                rows={wide ? 2 : undefined}
                aria-invalid={Boolean(errors[field])}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              />
              {errors[field] ? (
                <p className="text-xs text-destructive">{errorText(errors[field])}</p>
              ) : (
                t.has(`fields.${field}.hint`) && (
                  <p className="text-xs text-muted-foreground">
                    {t(`fields.${field}.hint`)}
                  </p>
                )
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={update.isPending}>
          {update.isPending ? t("saving") : t("save")}
        </Button>
        {data.updatedAt && (
          <p className="text-xs text-muted-foreground">
            {t("lastChanged", {
              date: format.dateTime(new Date(data.updatedAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
        )}
      </div>
    </Card>
  );
}
