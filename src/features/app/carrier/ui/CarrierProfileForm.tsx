"use client";

import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import {
  isValidSiret,
  normalizeSiret,
  isValidFrenchPhone,
  VAT_PATTERN,
  POSTAL_CODE_PATTERN,
} from "@/lib/french-identifiers";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSaveCarrierProfile } from "../hooks/useCarrier";
import type { CarrierApplication } from "../api/carrier.api";

type Translate = (key: string) => string;

/**
 * Client-side mirror of `upsertCarrierSchema` with translated messages.
 * The REST layer revalidates against the server DTO regardless.
 */
function buildSchema(t: Translate) {
  return z.object({
    companyName: z.string().min(2, t("errors.companyName")).max(200),
    siret: z.string().transform(normalizeSiret).refine(isValidSiret, t("errors.siret")),
    vatNumber: z
      .string()
      .regex(VAT_PATTERN, t("errors.vat"))
      .or(z.literal(""))
      .optional(),
    legalForm: z.string().max(100).optional(),
    contactPhone: z.string().refine(isValidFrenchPhone, t("errors.phone")),
    addressLine: z.string().min(1, t("errors.addressLine")).max(300),
    city: z.string().min(1, t("errors.city")).max(120),
    postalCode: z.string().regex(POSTAL_CODE_PATTERN, t("errors.postalCode")),
    bio: z.string().max(2000).optional(),
  });
}

type ProfileFormValues = z.infer<ReturnType<typeof buildSchema>>;

interface CarrierProfileFormProps {
  application: CarrierApplication | null;
}

/** Company details — create the draft or edit it in place. */
export function CarrierProfileForm({ application }: CarrierProfileFormProps) {
  const t = useTranslations("carrier.application.form");
  const save = useSaveCarrierProfile();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(buildSchema(t)),
    defaultValues: {
      companyName: application?.companyName ?? "",
      siret: application?.siret ?? "",
      vatNumber: application?.vatNumber ?? "",
      legalForm: application?.legalForm ?? "",
      contactPhone: application?.contactPhone ?? "",
      addressLine: application?.addressLine ?? "",
      city: application?.city ?? "",
      postalCode: application?.postalCode ?? "",
      bio: "",
    },
  });

  function onSubmit(values: ProfileFormValues) {
    save.mutate({
      companyName: values.companyName,
      siret: values.siret,
      vatNumber: values.vatNumber || undefined,
      legalForm: values.legalForm || undefined,
      contactPhone: values.contactPhone,
      addressLine: values.addressLine,
      city: values.city,
      postalCode: values.postalCode,
      bio: values.bio || undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <CompanyFields control={form.control} t={t} />
            <AddressFields control={form.control} t={t} />
            <div className="flex justify-end">
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? t("saving") : t("save")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

interface FieldGroupProps {
  control: Control<ProfileFormValues>;
  t: Translate;
}

function CompanyFields({ control, t }: FieldGroupProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <TextField control={control} name="companyName" label={t("companyName")} placeholder="Transport Express SAS" />
      <SiretField control={control} name="siret" label={t("siret")} />
      <TextField control={control} name="vatNumber" label={t("vatNumber")} placeholder="FRXX123456789" />
      <TextField control={control} name="legalForm" label={t("legalForm")} placeholder="SASU, SARL…" />
      <PhoneField control={control} name="contactPhone" label={t("contactPhone")} />
    </div>
  );
}

/** Strips the leading `+33`/`0` trunk prefix, leaving the national significant number. */
function toNationalNumber(value: string) {
  return value.replace(/^\+33\s*/, "").replace(/^0+/, "");
}

/** Groups raw digits the way a SIRET is printed on an official document: 3-3-3-5. */
function formatSiret(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 14);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9), digits.slice(9, 14)]
    .filter(Boolean)
    .join(" ");
}

function digitsBefore(value: string, caretPosition: number) {
  return value.slice(0, caretPosition).replace(/\D/g, "").length;
}

/** The caret position in `formatted` that sits right after its Nth digit. */
function caretAfterDigit(formatted: string, digitCount: number) {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === digitCount) return i + 1;
  }
  return formatted.length;
}

/** Auto-groups digits as 3-3-3-5 while typing, without disturbing the caret mid-edit. */
function SiretField({
  control,
  name,
  label,
}: {
  control: Control<ProfileFormValues>;
  name: "siret";
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              inputMode="numeric"
              placeholder="732 829 320 00074"
              value={formatSiret(field.value ?? "")}
              onChange={(e) => {
                const input = e.target;
                const digitCount = digitsBefore(input.value, input.selectionStart ?? input.value.length);
                const formatted = formatSiret(input.value);
                field.onChange(formatted);
                requestAnimationFrame(() => {
                  const caret = caretAfterDigit(formatted, digitCount);
                  input.setSelectionRange(caret, caret);
                });
              }}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * The carrier phone is France-only by design (a SIRET is required to apply),
 * so the `+33` country code is fixed rather than offered as a dropdown — see
 * ROADMAP.md §9 "Out of scope: multi-country expansion beyond France."
 */
function PhoneField({
  control,
  name,
  label,
}: {
  control: Control<ProfileFormValues>;
  name: "contactPhone";
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const national = toNationalNumber(field.value ?? "");
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                🇫🇷 +33
              </span>
              <FormControl>
                <Input
                  type="tel"
                  className="pl-18"
                  placeholder="6 12 34 56 78"
                  value={national}
                  onChange={(e) => {
                    const digits = toNationalNumber(e.target.value);
                    field.onChange(digits ? `+33 ${digits}` : "");
                  }}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

function AddressFields({ control, t }: FieldGroupProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <TextField control={control} name="addressLine" label={t("addressLine")} placeholder="12 rue de la Logistique" />
      </div>
      <TextField control={control} name="city" label={t("city")} placeholder="Lyon" />
      <TextField control={control} name="postalCode" label={t("postalCode")} placeholder="69000" maxLength={5} />
      <div className="md:col-span-2">
        <FormField
          control={control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("bio")}</FormLabel>
              <FormControl>
                <Textarea className="min-h-[80px]" placeholder={t("bioPlaceholder")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

interface TextFieldProps {
  control: Control<ProfileFormValues>;
  name: keyof ProfileFormValues;
  label: string;
  placeholder?: string;
  maxLength?: number;
}

function TextField({ control, name, label, placeholder, maxLength }: TextFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input placeholder={placeholder} maxLength={maxLength} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
