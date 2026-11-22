"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { VEHICLE_TYPES, type VehicleType } from "@/lib/carrier-constants";
import { CARRIER_KINDS, carrierKindLabel } from "@/lib/carrier-kind";
import type { CarrierApplication, CarrierFileInput } from "../api/carriers.api";

interface FormState {
  inHouse: boolean;
  companyName: string;
  siret: string;
  vatNumber: string;
  legalForm: string;
  contactPhone: string;
  addressLine: string;
  city: string;
  postalCode: string;
  bio: string;
}

function initialState(application: CarrierApplication): FormState {
  const inHouse = application.kind === "private";
  return {
    inHouse,
    companyName: inHouse ? "" : application.companyName,
    siret: application.siret ?? "",
    vatNumber: application.vatNumber ?? "",
    legalForm: application.legalForm ?? "",
    contactPhone: application.contactPhone,
    addressLine: application.addressLine,
    city: application.city,
    postalCode: application.postalCode,
    bio: application.bio ?? "",
  };
}

function toPayload(form: FormState): CarrierFileInput {
  const contact = {
    contactPhone: form.contactPhone,
    addressLine: form.addressLine,
    city: form.city,
    postalCode: form.postalCode,
    bio: form.bio || undefined,
  };
  return form.inHouse
    ? { kind: "private", ...contact }
    : {
        kind: "professional",
        companyName: form.companyName,
        siret: form.siret,
        vatNumber: form.vatNumber || undefined,
        legalForm: form.legalForm || undefined,
        ...contact,
      };
}

function TextField({
  id,
  label,
  value,
  onChange,
  disabled,
  className,
  ...rest
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  className?: string;
} & Omit<React.ComponentProps<typeof Input>, "id" | "value" | "onChange">) {
  return (
    <div className={className ?? "space-y-2"}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </div>
  );
}

interface CarrierFileEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: CarrierApplication;
  onSave: (input: { id: string; data: CarrierFileInput }) => Promise<unknown>;
  onAddVehicle: (input: {
    id: string;
    vehicle: { type: VehicleType; maxWeightKg: number; plateNumber: string };
  }) => Promise<unknown>;
  isSaving: boolean;
}

/**
 * Staff finish a driver's file for them: the contact and company details, and
 * a vehicle. The pending application (or the empty file « Gérer le rôle »
 * creates) no longer has to wait on the person (driver_types_spec.md §7).
 * Documents and banking stay the person's own, so they are not edited here.
 */
export function CarrierFileEditor({
  open,
  onOpenChange,
  application,
  onSave,
  onAddVehicle,
  isSaving,
}: CarrierFileEditorProps) {
  const [form, setForm] = useState<FormState>(() => initialState(application));
  const [vehicleType, setVehicleType] = useState<VehicleType | "">("");
  const [maxWeightKg, setMaxWeightKg] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const t = useTranslations("admin.carriers.editor");
  const tTypes = useTranslations("admin.carriers.vehicleTypes");
  const locale = useLocale();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  // The kind cannot change once approved (the server refuses it too).
  const kindLocked = application.status === "approved" || application.status === "suspended";

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await onSave({ id: application.id, data: toPayload(form) });
      onOpenChange(false);
    } catch {
      // The failure toast is raised by the mutation.
    }
  };

  const addVehicle = async () => {
    if (!vehicleType) return;
    try {
      await onAddVehicle({
        id: application.id,
        vehicle: { type: vehicleType, maxWeightKg: Number(maxWeightKg), plateNumber },
      });
      setVehicleType("");
      setMaxWeightKg("");
      setPlateNumber("");
    } catch {
      // The failure toast is raised by the mutation.
    }
  };

  const canAddVehicle = vehicleType !== "" && Number(maxWeightKg) > 0 && plateNumber.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description", { name: application.user.name })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-5">
          {/* The same two words as the table, the filter and the alert mail
              (`carrierKindLabel`) — a radio, because it is one or the other. */}
          <fieldset className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {CARRIER_KINDS.map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="radio"
                    name="editor-kind"
                    className="size-4 accent-primary"
                    checked={form.inHouse === (value === "private")}
                    disabled={kindLocked || isSaving}
                    onChange={() => set("inHouse", value === "private")}
                  />
                  {carrierKindLabel(value, locale)}
                </label>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {kindLocked ? t("kindLocked") : t("inHouseHelp")}
            </p>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {!form.inHouse && (
              <>
                <TextField id="editor-company" label={t("companyName")} value={form.companyName}
                  onChange={(v) => set("companyName", v)} disabled={isSaving} />
                <TextField id="editor-siret" label={t("siret")} value={form.siret}
                  placeholder="732 829 320 00074" onChange={(v) => set("siret", v)} disabled={isSaving} />
                <TextField id="editor-vat" label={t("vatNumber")} value={form.vatNumber}
                  onChange={(v) => set("vatNumber", v)} disabled={isSaving} />
                <TextField id="editor-legal" label={t("legalForm")} value={form.legalForm}
                  onChange={(v) => set("legalForm", v)} disabled={isSaving} />
              </>
            )}
            <TextField id="editor-phone" label={t("contactPhone")} value={form.contactPhone} type="tel"
              placeholder="06 12 34 56 78 · +32 470 12 34 56" onChange={(v) => set("contactPhone", v)} disabled={isSaving} />
            <TextField id="editor-address" label={t("addressLine")} value={form.addressLine}
              className="space-y-2 md:col-span-2" onChange={(v) => set("addressLine", v)} disabled={isSaving} />
            <TextField id="editor-city" label={t("city")} value={form.city}
              onChange={(v) => set("city", v)} disabled={isSaving} />
            <TextField id="editor-postal" label={t("postalCode")} value={form.postalCode}
              maxLength={10} onChange={(v) => set("postalCode", v)} disabled={isSaving} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editor-bio">{t("bio")}</Label>
            <Textarea id="editor-bio" className="min-h-[70px]" value={form.bio}
              onChange={(e) => set("bio", e.target.value)} disabled={isSaving} />
          </div>

          <fieldset className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-semibold">{t("vehicle")}</legend>
            <p className="text-xs text-muted-foreground">
              {t("vehicleHelp", { count: application.vehicles.length })}
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="editor-vehicle-type">{t("vehicleType")}</Label>
                <Select value={vehicleType} onValueChange={(v) => setVehicleType(v as VehicleType)}>
                  <SelectTrigger id="editor-vehicle-type" className="w-full">
                    <SelectValue placeholder={t("vehicleTypePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{tTypes(type)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TextField id="editor-vehicle-weight" label={t("maxWeightKg")} value={maxWeightKg} type="number"
                onChange={setMaxWeightKg} disabled={isSaving} />
              <TextField id="editor-vehicle-plate" label={t("plateNumber")} value={plateNumber}
                placeholder="AB-123-CD" onChange={setPlateNumber} disabled={isSaving} />
              <div className="flex items-end">
                <Button type="button" variant="outline" disabled={!canAddVehicle || isSaving}
                  onClick={() => void addVehicle()}>
                  {t("addVehicle")}
                </Button>
              </div>
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <LottieLoader width={20} height={20} /> : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
