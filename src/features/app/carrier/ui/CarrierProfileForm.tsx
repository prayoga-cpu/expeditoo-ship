"use client";

import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Building2, UserRound } from "lucide-react";
import {
  formatCompanyNumber,
  isValidCompanyNumber,
  isValidContactPhone,
  isValidContactPostalCode,
  isValidVat,
  normalizeCompanyNumber,
  normalizeContactPhone,
  normalizeVat,
} from "@/lib/french-identifiers";
import { CARRIER_KINDS, type CarrierKind } from "@/lib/carrier-kind";
import { cn } from "@/lib/utils";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useSaveCarrierProfile } from "../hooks/useCarrier";
import type { CarrierApplication } from "../api/carrier.api";

type Translate = (key: string) => string;

/**
 * Client-side mirror of `upsertCarrierSchema` with translated messages.
 * The REST layer revalidates against the server DTO regardless.
 *
 * One schema for both kinds: a « particulier » (the in-house driver, `private`)
 * is asked only how to reach them, a professional is asked for the company as
 * well (driver_types_spec.md §3). Every format rule is the DTO's own, from
 * `@/lib/french-identifiers` — French or international (§8).
 */
function buildSchema(t: Translate) {
  return z
    .object({
      kind: z.enum(CARRIER_KINDS),
      companyName: z.string().max(200),
      siret: z.string(),
      vatNumber: z.string().optional(),
      legalForm: z.string().max(100).optional(),
      contactPhone: z.string().refine(isValidContactPhone, t("errors.phone")),
      addressLine: z.string().min(1, t("errors.addressLine")).max(300),
      city: z.string().min(1, t("errors.city")).max(120),
      postalCode: z.string().refine(isValidContactPostalCode, t("errors.postalCode")),
      bio: z.string().max(2000).optional(),
    })
    .superRefine((values, ctx) => {
      if (values.kind === "private") return;
      if (values.companyName.trim().length < 2) {
        ctx.addIssue({ code: "custom", path: ["companyName"], message: t("errors.companyName") });
      }
      if (!isValidCompanyNumber(values.siret)) {
        ctx.addIssue({ code: "custom", path: ["siret"], message: t("errors.siret") });
      }
      if (values.vatNumber && !isValidVat(values.vatNumber)) {
        ctx.addIssue({ code: "custom", path: ["vatNumber"], message: t("errors.vat") });
      }
    });
}

type ProfileFormValues = z.infer<ReturnType<typeof buildSchema>>;

interface CarrierProfileFormProps {
  application: CarrierApplication | null;
}

/** Which of the two kinds, then its details — create the draft or edit it in place. */
export function CarrierProfileForm({ application }: CarrierProfileFormProps) {
  const t = useTranslations("carrier.application.form");
  const save = useSaveCarrierProfile();
  // The server refuses the change with `KIND_LOCKED` once the role is granted
  // (driver_types_spec.md §3); the choice says so instead of failing on save.
  const kindLocked =
    application?.status === "approved" || application?.status === "suspended";

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(buildSchema(t)),
    defaultValues: {
      kind: application?.kind ?? "professional",
      companyName: application?.kind === "private" ? "" : (application?.companyName ?? ""),
      siret: formatCompanyNumber(application?.siret ?? ""),
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
    const contact = {
      contactPhone: normalizeContactPhone(values.contactPhone),
      addressLine: values.addressLine,
      city: values.city,
      postalCode: values.postalCode.trim(),
      bio: values.bio || undefined,
    };
    save.mutate(
      values.kind === "private"
        ? { kind: "private", ...contact }
        : {
            kind: "professional",
            companyName: values.companyName,
            siret: normalizeCompanyNumber(values.siret),
            vatNumber: values.vatNumber ? normalizeVat(values.vatNumber) : undefined,
            legalForm: values.legalForm || undefined,
            ...contact,
          }
    );
  }

  const inHouse = form.watch("kind") === "private";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {inHouse ? (
            <UserRound className="h-5 w-5 text-primary" />
          ) : (
            <Building2 className="h-5 w-5 text-primary" />
          )}
          {inHouse ? t("inHouse.title") : t("title")}
        </CardTitle>
        <CardDescription>
          {inHouse ? t("inHouse.description") : t("description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <KindChoice control={form.control} t={t} locked={kindLocked} />
            {!inHouse && <CompanyFields control={form.control} t={t} />}
            {inHouse && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <PhoneField control={form.control} t={t} />
              </div>
            )}
            <AddressFields control={form.control} t={t} inHouse={inHouse} />
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
      <CompanyNumberField control={control} t={t} />
      <TextField control={control} name="vatNumber" label={t("vatNumber")} placeholder="FR12345678901" />
      <TextField control={control} name="legalForm" label={t("legalForm")} placeholder="SASU, SARL…" />
      <PhoneField control={control} t={t} />
    </div>
  );
}

/**
 * A SIRET or a foreign company number, so the field takes letters as well as
 * digits and never reshapes what is being typed. A SIRET is regrouped 3-3-3-5
 * on leaving the field, the way it is printed on an official document.
 */
function CompanyNumberField({ control, t }: FieldGroupProps) {
  return (
    <FormField
      control={control}
      name="siret"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("siret")}</FormLabel>
          <FormControl>
            <Input
              placeholder="732 829 320 00074"
              maxLength={32}
              autoCapitalize="characters"
              {...field}
              onBlur={() => {
                field.onChange(formatCompanyNumber(field.value ?? ""));
                field.onBlur();
              }}
            />
          </FormControl>
          <FormDescription>{t("siretHelp")}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * A free field: the prefix used to be a fixed « +33 », which left a carrier
 * registered in Belgium or Germany no way to give their number. A French
 * number is still saved as « +33 6 12 34 56 78 » (`normalizeContactPhone`,
 * on leaving the field and again on save).
 */
function PhoneField({ control, t }: FieldGroupProps) {
  return (
    <FormField
      control={control}
      name="contactPhone"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("contactPhone")}</FormLabel>
          <FormControl>
            <Input
              type="tel"
              autoComplete="tel"
              placeholder="06 12 34 56 78 · +32 470 12 34 56"
              maxLength={24}
              {...field}
              onBlur={() => {
                field.onChange(normalizeContactPhone(field.value ?? ""));
                field.onBlur();
              }}
            />
          </FormControl>
          <FormDescription>{t("phoneHelp")}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/**
 * « Particulier » or « Professionnel » — the first question, because it
 * decides every other one. Two cards rather than a tick: a tick reads as an
 * exception to a default, and neither kind is the exception. Choosing
 * « particulier » approves nothing: an admin still validates the file by hand,
 * since an approved driver reads street addresses (driver_types_spec.md §3).
 */
function KindChoice({ control, t, locked }: FieldGroupProps & { locked: boolean }) {
  return (
    <FormField
      control={control}
      name="kind"
      render={({ field }) => (
        <FormItem className="space-y-3">
          <FormLabel id="carrier-kind-legend">{t("kind.legend")}</FormLabel>
          <RadioGroup
            aria-labelledby="carrier-kind-legend"
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
            value={field.value}
            onValueChange={(value) => field.onChange(value as CarrierKind)}
            disabled={locked}
          >
            {CARRIER_KINDS.map((kind) => (
              <KindCard key={kind} kind={kind} t={t} selected={field.value === kind} locked={locked} />
            ))}
          </RadioGroup>
          {locked && <p className="text-sm text-muted-foreground">{t("kind.locked")}</p>}
        </FormItem>
      )}
    />
  );
}

function KindCard({
  kind,
  t,
  selected,
  locked,
}: {
  kind: CarrierKind;
  t: Translate;
  selected: boolean;
  locked: boolean;
}) {
  const Icon = kind === "private" ? UserRound : Building2;

  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4 transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border",
        locked ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-muted/50"
      )}
    >
      <RadioGroupItem
        value={kind}
        className="mt-0.5"
        aria-labelledby={`carrier-kind-${kind}-title`}
        aria-describedby={`carrier-kind-${kind}-body`}
      />
      <span className="min-w-0 space-y-1">
        <span id={`carrier-kind-${kind}-title`} className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          {t(`kind.${kind}.title`)}
        </span>
        <span id={`carrier-kind-${kind}-body`} className="block text-sm text-muted-foreground">
          {t(`kind.${kind}.body`)}
        </span>
      </span>
    </label>
  );
}

function AddressFields({
  control,
  t,
  inHouse,
}: FieldGroupProps & { inHouse: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <TextField control={control} name="addressLine" label={t("addressLine")} placeholder="12 rue de la Logistique" />
      </div>
      <TextField control={control} name="city" label={t("city")} placeholder="Lyon" />
      <TextField control={control} name="postalCode" label={t("postalCode")} placeholder="69000" maxLength={10} />
      <div className="md:col-span-2">
        <FormField
          control={control}
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{inHouse ? t("inHouse.bio") : t("bio")}</FormLabel>
              <FormControl>
                <Textarea
                  className="min-h-[80px]"
                  placeholder={inHouse ? t("inHouse.bioPlaceholder") : t("bioPlaceholder")}
                  {...field}
                />
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
  name: Exclude<keyof ProfileFormValues, "kind">;
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
