"use client";

import type { ReactNode } from "react";
import { MapPin, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addressDisplayName } from "@/lib/saved-address";
import { cn } from "@/lib/utils";
import type { Address } from "../hooks/useAddressBook";
import type { Side } from "../address-book";

/**
 * Secondary text inside an option: muted, except on the highlighted option,
 * whose accent background a muted grey does not read on.
 */
const ON_HIGHLIGHT =
  "text-muted-foreground group-data-[highlighted]:text-accent-foreground/80";

/** The option that clears the end for a new address. Never an address id. */
const NEW_ADDRESS = "__new__";

interface SavedAddressPickerProps {
  id: string;
  /** The end this picker fills. */
  side: Side;
  addresses: Address[];
  /** The saved address this end holds, or `undefined` for a new one. */
  selectedId: string | undefined;
  /** The saved address the other end holds, labelled as such in the list. */
  otherSideId: string | undefined;
  /** `null` means "enter a new address" was chosen. */
  onSelect: (address: Address | null) => void;
}

/**
 * A dropdown of the requester's saved addresses, with « Saisir une nouvelle
 * adresse » always last (saved_addresses_spec.md §3.1). An address already at
 * the other end says so but stays selectable: choosing it is refused by the
 * schema, in words, rather than hidden.
 */
export function SavedAddressPicker({
  id,
  side,
  addresses,
  selectedId,
  otherSideId,
  onSelect,
}: SavedAddressPickerProps) {
  const t = useTranslations("create.where");
  const tPreset = useTranslations("profile.address.form.labelPresets");
  const name = (address: Address) => addressDisplayName(address, (p) => tPreset(p));
  const selected = addresses.find((a) => a.id === selectedId);
  const otherSide: Side = side === "pickup" ? "dropoff" : "pickup";

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{t("savedAddress")}</Label>
      <Select
        value={selected?.id ?? NEW_ADDRESS}
        onValueChange={(value) =>
          onSelect(addresses.find((a) => a.id === value) ?? null)
        }
      >
        {/* Two lines, where the shared trigger is one fixed-height row. */}
        <SelectTrigger
          id={id}
          className="min-h-11 w-full py-2 text-left whitespace-normal data-[size=default]:h-auto *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:min-w-0"
        >
          <SelectValue>
            {selected ? (
              <span className="flex min-w-0 items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{name(selected)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {oneLine(selected)}
                  </span>
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                <span className="font-medium">{t("useNewAddress")}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
          {addresses.map((address) => (
            <SelectItem
              key={address.id}
              value={address.id}
              className="group py-2 *:[span]:last:min-w-0"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{name(address)}</span>
                  {address.isDefault && <Badge>{t("defaultAddress")}</Badge>}
                  {address.usedFor && <Badge>{t(address.usedFor)}</Badge>}
                  {address.id === otherSideId && (
                    <span className={cn("text-xs", ON_HIGHLIGHT)}>
                      {t(`alreadyAt.${otherSide}`)}
                    </span>
                  )}
                </span>
                <span className={cn("truncate text-xs", ON_HIGHLIGHT)}>
                  {oneLine(address)}
                </span>
              </span>
            </SelectItem>
          ))}
          <SelectItem value={NEW_ADDRESS} className="py-2">
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              <span className="font-medium">{t("useNewAddress")}</span>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function oneLine(address: Address): string {
  return `${address.street}, ${address.zip} ${address.city}`;
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}
