"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ADDRESS_LABEL_PRESETS, addressLabelPreset } from "@/lib/saved-address";

const OTHER = "other";

interface AddressLabelFieldProps {
  id: string;
  /** The field's own label. */
  label: string;
  /** What is stored: a preset id, a name typed by hand, or "" for none yet. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * A saved address's name: a preset, stored as its id and shown in the
 * reader's language, or « Autre » and a name typed by hand
 * (saved_addresses_spec.md §5). Shared by the profile form and `/create`, so
 * an address is named the same way wherever it is saved.
 */
export function AddressLabelField({ id, label, value, onChange }: AddressLabelFieldProps) {
  const t = useTranslations("profile.address.form");
  const preset = addressLabelPreset(value);
  // « Autre » chosen and nothing typed yet is a state the value cannot hold.
  const [typing, setTyping] = useState(false);
  const typed = value.trim() !== "" && preset === null;
  const choice = typing || typed ? OTHER : (preset ?? "");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={choice}
        onValueChange={(next) => {
          setTyping(next === OTHER);
          onChange(next === OTHER ? "" : next);
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={t("labelPresetPlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {ADDRESS_LABEL_PRESETS.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`labelPresets.${option}`)}
            </SelectItem>
          ))}
          <SelectItem value={OTHER}>{t("labelPresets.other")}</SelectItem>
        </SelectContent>
      </Select>
      {choice === OTHER && (
        <Input
          id={`${id}-custom`}
          aria-label={t("label")}
          placeholder={t("labelPlaceholder")}
          maxLength={50}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
