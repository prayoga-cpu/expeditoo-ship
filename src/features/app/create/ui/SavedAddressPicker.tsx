"use client";

import { Check, MapPin, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Address } from "../hooks/useAddressBook";

interface SavedAddressPickerProps {
  addresses: Address[];
  /** The matched saved address id, or "custom" when none of them match. */
  selectedId: string | "custom";
  /** `null` means "enter a new address" was chosen. */
  onSelect: (address: Address | null) => void;
}

/**
 * A compact, radio-like list for choosing a saved address inline, in a form
 * — not `/profile/addresses`' own `AddressManagement.tsx`, which is a full
 * page with its own edit/delete menu and isn't droppable into a wizard step.
 * "Enter a new address" is always the trailing option, never hidden, so
 * picking a saved address is never the only way through this step.
 */
export function SavedAddressPicker({
  addresses,
  selectedId,
  onSelect,
}: SavedAddressPickerProps) {
  const t = useTranslations("create.where");

  return (
    <div className="space-y-2">
      {addresses.map((address) => {
        const selected = address.id === selectedId;
        return (
          <button
            key={address.id}
            type="button"
            onClick={() => onSelect(address)}
            aria-pressed={selected}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
              selected
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            )}
          >
            <MapPin
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{address.label}</span>
                {address.isDefault && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {t("defaultAddress")}
                  </span>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {address.street}, {address.zip} {address.city}
              </p>
            </div>
            {selected && (
              <Check
                className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                aria-hidden
              />
            )}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selectedId === "custom"}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg border border-dashed p-3 text-left transition-colors",
          selectedId === "custom"
            ? "border-primary bg-primary/5"
            : "border-border hover:bg-muted/50"
        )}
      >
        <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="font-medium">{t("useNewAddress")}</span>
      </button>
    </div>
  );
}
