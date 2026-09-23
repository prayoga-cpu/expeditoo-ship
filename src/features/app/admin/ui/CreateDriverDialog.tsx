"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { VEHICLE_TYPES, type VehicleType } from "@/lib/carrier-constants";
import type { CreateDriverInput, CreateDriverResult } from "../api/carriers.api";

type FormState = Omit<CreateDriverInput, "vehicle"> & {
  vehicleType: VehicleType | "";
  maxWeightKg: string;
  plateNumber: string;
};

type TextKey = Exclude<keyof FormState, "vehicleType">;
type SetField = (name: keyof FormState, value: string) => void;

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  companyName: "",
  siret: "",
  vatNumber: "",
  legalForm: "",
  contactPhone: "",
  addressLine: "",
  city: "",
  postalCode: "",
  bio: "",
  vehicleType: "",
  maxWeightKg: "",
  plateNumber: "",
};

function toPayload(form: FormState): CreateDriverInput {
  const { vehicleType, maxWeightKg, plateNumber, ...rest } = form;
  return {
    ...rest,
    vatNumber: rest.vatNumber || undefined,
    legalForm: rest.legalForm || undefined,
    bio: rest.bio || undefined,
    vehicle: {
      type: vehicleType as VehicleType,
      maxWeightKg: Number(maxWeightKg),
      plateNumber,
    },
  };
}

interface FieldProps
  extends Omit<React.ComponentProps<typeof Input>, "id" | "value" | "onChange"> {
  name: TextKey;
  label: string;
  values: FormState;
  onChange: SetField;
}

function Field({ name, label, values, onChange, className, ...inputProps }: FieldProps) {
  const id = `driver-${name}`;
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={values[name] ?? ""}
        onChange={(e) => onChange(name, e.target.value)}
        {...inputProps}
      />
    </div>
  );
}

interface SectionProps {
  values: FormState;
  onChange: SetField;
  disabled: boolean;
}

function ProfileFields(props: SectionProps) {
  const t = useTranslations("admin.drivers.createDialog.fields");
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field name="name" label={t("name")} required {...props} />
      <Field name="email" label={t("email")} type="email" required {...props} />
      <Field name="companyName" label={t("companyName")} required {...props} />
      <Field
        name="siret"
        label={t("siret")}
        inputMode="numeric"
        placeholder="732 829 320 00074"
        required
        {...props}
      />
      <Field
        name="contactPhone"
        label={t("contactPhone")}
        type="tel"
        placeholder="06 12 34 56 78"
        required
        {...props}
      />
      <Field name="legalForm" label={t("legalForm")} placeholder="SASU, SARL…" {...props} />
      <Field name="addressLine" label={t("addressLine")} className="md:col-span-2" required {...props} />
      <Field name="city" label={t("city")} required {...props} />
      <Field
        name="postalCode"
        label={t("postalCode")}
        inputMode="numeric"
        pattern="[0-9]{5}"
        maxLength={5}
        required
        {...props}
      />
    </div>
  );
}

function VehicleFields({ values, onChange, disabled }: SectionProps) {
  const t = useTranslations("admin.drivers.createDialog.fields");
  const tTypes = useTranslations("admin.carriers.vehicleTypes");
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold">{t("vehicle")}</legend>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
        <div className="space-y-2">
          <Label htmlFor="driver-vehicleType">{t("vehicleType")}</Label>
          <Select
            required
            value={values.vehicleType}
            onValueChange={(value) => onChange("vehicleType", value)}
            disabled={disabled}
          >
            <SelectTrigger id="driver-vehicleType" className="w-full">
              <SelectValue placeholder={t("vehicleTypePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {tTypes(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Field
          name="maxWeightKg"
          label={t("maxWeightKg")}
          type="number"
          min={1}
          max={44000}
          required
          values={values}
          onChange={onChange}
          disabled={disabled}
        />
        <Field
          name="plateNumber"
          label={t("plateNumber")}
          placeholder="AB-123-CD"
          pattern="[A-Za-z]{2}-[0-9]{3}-[A-Za-z]{2}"
          required
          values={values}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    </fieldset>
  );
}

interface CreateDriverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: CreateDriverInput) => Promise<CreateDriverResult>;
  isCreating: boolean;
}

/** in_house_drivers_spec.md §6 — approved on submit; the admin is the review. */
export function CreateDriverDialog({
  open,
  onOpenChange,
  onCreate,
  isCreating,
}: CreateDriverDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const t = useTranslations("admin.drivers.createDialog");
  const { toast } = useToast();
  const onChange: SetField = (name, value) =>
    setForm((prev) => ({ ...prev, [name]: value }));
  const section = { values: form, onChange, disabled: isCreating };

  const handleOpenChange = (next: boolean) => {
    if (isCreating) return;
    onOpenChange(next);
    if (!next) setForm(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await onCreate(toPayload(form));
      toast({
        description: result.accountCreated
          ? t("toasts.created")
          : t("toasts.converted", { email: result.email }),
      });
      handleOpenChange(false);
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <ProfileFields {...section} />
          <VehicleFields {...section} />

          <div className="space-y-2">
            <Label htmlFor="driver-bio">{t("fields.bio")}</Label>
            <Textarea
              id="driver-bio"
              className="min-h-[80px]"
              value={form.bio}
              onChange={(e) => onChange("bio", e.target.value)}
              disabled={isCreating}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isCreating}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? <LottieLoader width={20} height={20} /> : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
