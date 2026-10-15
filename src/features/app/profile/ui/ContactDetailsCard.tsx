"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Edit2, IdCard } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { InlineLoader } from "@/components/ui/page-loader";
import type { ContactDetails, ContactDetailsInput } from "../api/contact.api";
import {
  contactFormSchema,
  toFormValues,
  useMyContactDetails,
  useSaveContactDetails,
} from "../hooks/useContactDetails";

type Errors = Partial<Record<keyof ContactDetailsInput, string>>;

/**
 * « Coordonnées personnelles » on `/profile`, for requesters and carriers
 * alike: the name in parts, an optional alias, a phone, and someone close to
 * call (client_feedback_2026_10_spec.md §7b). Seen by the owner and by staff,
 * by nobody else — the card says so, because a relative's number is not the
 * owner's own data to hand out.
 */
export function ContactDetailsCard() {
  const t = useTranslations("profile.contact");
  const [editing, setEditing] = useState(false);
  const { data, isLoading, isError, refetch } = useMyContactDetails();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <IdCard className="h-5 w-5 text-primary" />
          {t("title")}
        </CardTitle>
        {!editing && data && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={t("edit")}>
            <Edit2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <InlineLoader size="md" className="h-16" />
        ) : isError || !data ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-destructive">{t("loadError")}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t("retry")}
            </Button>
          </div>
        ) : editing ? (
          <ContactForm details={data} onDone={() => setEditing(false)} />
        ) : (
          <ContactSummary details={data} />
        )}
        <p className="text-xs text-muted-foreground">{t("privacy")}</p>
      </CardContent>
    </Card>
  );
}

/** The saved details, read-only. Shared with the staff view of an account. */
export function ContactSummary({ details }: { details: ContactDetails }) {
  const t = useTranslations("profile.contact");
  const values = toFormValues(details);
  const fullName = [values.firstName, values.lastName].filter(Boolean).join(" ");
  const relative = [details.relativeName, details.relativePhone].filter(Boolean).join(" — ");

  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <SummaryRow label={t("fullName")}>{fullName || t("notSet")}</SummaryRow>
      <SummaryRow label={t("alias")}>{details.alias || t("notSet")}</SummaryRow>
      <SummaryRow label={t("phone")}>{details.phone || t("notSet")}</SummaryRow>
      <SummaryRow label={t("relativeTitle")}>{relative || t("notSet")}</SummaryRow>
    </dl>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words font-medium">{children}</dd>
    </div>
  );
}

function validate(values: ContactDetailsInput): Errors {
  const result = contactFormSchema.safeParse(values);
  if (result.success) return {};
  const errors: Errors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof ContactDetailsInput;
    errors[key] ??= issue.message;
  }
  return errors;
}

function ContactForm({ details, onDone }: { details: ContactDetails; onDone: () => void }) {
  const t = useTranslations("profile.contact");
  const save = useSaveContactDetails();
  const [values, setValues] = useState(() => toFormValues(details));
  const [errors, setErrors] = useState<Errors>({});
  const set = (key: keyof ContactDetailsInput) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = () => {
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    save.mutate(values, {
      onSuccess: () => {
        toast.success(t("saved"));
        onDone();
      },
      onError: () => toast.error(t("saveFailed")),
    });
  };

  return (
    <div className="space-y-4">
      <ContactFields values={values} errors={errors} set={set} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone} disabled={save.isPending}>
          {t("cancel")}
        </Button>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}

interface FieldsProps {
  values: ContactDetailsInput;
  errors: Errors;
  set: (key: keyof ContactDetailsInput) => (value: string) => void;
}

function ContactFields({ values, errors, set }: FieldsProps) {
  const t = useTranslations("profile.contact");
  const text = (key: keyof ContactDetailsInput, label: string, required = false) => (
    <FormRow id={`contact-${key}`} label={label} required={required} error={errors[key]}>
      <Input
        id={`contact-${key}`}
        value={values[key]}
        onChange={(e) => set(key)(e.target.value)}
        aria-invalid={Boolean(errors[key])}
      />
    </FormRow>
  );
  const phone = (key: "phone" | "relativePhone", label: string) => (
    <FormRow id={`contact-${key}`} label={label} error={errors[key]}>
      <PhoneInput
        id={`contact-${key}`}
        value={values[key]}
        onChange={set(key)}
        placeholder={t("phonePlaceholder")}
        aria-invalid={Boolean(errors[key])}
      />
    </FormRow>
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {text("firstName", t("firstName"), true)}
        {text("lastName", t("lastName"), true)}
      </div>
      {text("alias", t("alias"))}
      {phone("phone", t("phone"))}
      <fieldset className="space-y-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">{t("relativeTitle")}</legend>
        <p className="text-xs text-muted-foreground">{t("relativeHint")}</p>
        {text("relativeName", t("relativeName"))}
        {phone("relativePhone", t("relativePhone"))}
      </fieldset>
    </>
  );
}

function FormRow({
  id,
  label,
  required = false,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  const t = useTranslations("profile.contact");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {error && <p className="text-sm text-destructive">{t(error)}</p>}
    </div>
  );
}
