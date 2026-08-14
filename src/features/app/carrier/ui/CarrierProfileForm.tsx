"use client";

import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import {
  isValidSiret,
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
    siret: z.string().refine(isValidSiret, t("errors.siret")),
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
      <TextField control={control} name="siret" label={t("siret")} placeholder="12345678901234" maxLength={14} />
      <TextField control={control} name="vatNumber" label={t("vatNumber")} placeholder="FRXX123456789" />
      <TextField control={control} name="legalForm" label={t("legalForm")} placeholder="SASU, SARL…" />
      <TextField control={control} name="contactPhone" label={t("contactPhone")} placeholder="+33 6 12 34 56 78" />
    </div>
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
