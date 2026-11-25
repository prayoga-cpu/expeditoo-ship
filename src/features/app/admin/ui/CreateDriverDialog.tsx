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
import { ApiError } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { VEHICLE_TYPES, type VehicleType } from "@/lib/carrier-constants";
import type { CreateDriverInput, CreateDriverResult } from "../api/carriers.api";

type FormState = Omit<CreateDriverInput, "vehicle" | "name"> & {
  name: string;
  vehicleType: VehicleType | "";
  maxWeightKg: string;
  plateNumber: string;
};

type TextKey = Exclude<keyof FormState, "vehicleType">;
type SetField = (name: keyof FormState, value: string) => void;

const EMPTY_FORM: FormState = {
  mode: "invite",
  name: "",
  email: "",
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
  const { vehicleType, maxWeightKg, plateNumber, name, ...rest } = form;
  return {
    ...rest,
    // A registered account keeps its own name; only an invitation needs one.
    name: rest.mode === "invite" ? name : undefined,
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
  const invite = props.values.mode === "invite";
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {invite && <Field name="name" label={t("name")} required {...props} />}
      <Field
        name="email"
        label={t("email")}
        type="email"
        required
        className={cn("space-y-2", !invite && "md:col-span-2")}
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
      <Field name="addressLine" label={t("addressLine")} className="md:col-span-2" required {...props} />
      <Field name="city" label={t("city")} required {...props} />
      <Field
        name="postalCode"
        label={t("postalCode")}
        maxLength={10}
        required
        {...props}
      />
    </div>
  );
}

/**
 * Registered account, or a person who has none yet. Either way the person ends
 * up an approved in-house driver; the difference is what happens to the email:
 * an existing account is converted and told nothing, a new one is created and
 * sent an invitation to choose a password (driver_types_spec.md §4).
 */
function ModeChoice({ values, onChange, disabled }: SectionProps) {
  const t = useTranslations("admin.drivers.createDialog.mode");
  const options = ["invite", "existing"] as const;
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-semibold">{t("legend")}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((mode) => (
          <label
            key={mode}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm transition-colors",
              values.mode === mode ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              <input
                type="radio"
                name="driver-mode"
                value={mode}
                checked={values.mode === mode}
                onChange={() => onChange("mode", mode)}
              />
              {t(`${mode}.label`)}
            </span>
            <span className="text-muted-foreground">{t(`${mode}.help`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
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
          ? t("toasts.invited", { email: result.email })
          : t("toasts.converted", { email: result.email }),
      });
      handleOpenChange(false);
    } catch (error) {
      // The refusals staff actually hit have a sentence; the server's own
      // message is English and never shown.
      const code = error instanceof ApiError ? error.code : null;
      toast({
        description:
          code && t.has(`toasts.errors.${code}`)
            ? t(`toasts.errors.${code}`)
            : t("toasts.failed"),
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
          <ModeChoice {...section} />
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
