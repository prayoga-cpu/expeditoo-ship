/**
 * What a saved address is called, and which end of a transport it usually is
 * (saved_addresses_spec.md §2, §5). Pure, so the server's DTO, the Drizzle
 * column and both forms share one list.
 */

/** The ends a saved address can be kept for. `null` on a row means either. */
export const ADDRESS_SIDES = ["pickup", "dropoff"] as const;
export type AddressSide = (typeof ADDRESS_SIDES)[number];

/**
 * The names offered in a select, stored as their id and shown in the reader's
 * language. « Autre » is the free-text choice, not a stored value.
 */
export const ADDRESS_LABEL_PRESETS = [
  "home",
  "work",
  "storage",
  "neighbour",
] as const;
export type AddressLabelPreset = (typeof ADDRESS_LABEL_PRESETS)[number];

// `AddressForm` once saved `t("labelPresets.home")` under a namespace where
// that key did not exist, and next-intl answers a missing key with its path —
// so the path was stored as the name. Both shapes are read back as the preset.
const LEGACY_KEY = /^profile\.address\.(?:form\.)?labelPresets\.([a-z]+)$/;

function isPreset(value: string): value is AddressLabelPreset {
  return (ADDRESS_LABEL_PRESETS as readonly string[]).includes(value);
}

/** The preset a stored label stands for, or `null` for a name typed by hand. */
export function addressLabelPreset(label: string): AddressLabelPreset | null {
  const trimmed = label.trim();
  if (isPreset(trimmed)) return trimmed;
  const legacy = LEGACY_KEY.exec(trimmed)?.[1];
  return legacy && isPreset(legacy) ? legacy : null;
}

/**
 * The name to show for a saved address: a preset in the reader's language, a
 * typed name as typed, and — when there is none — the town it is in.
 */
export function addressDisplayName(
  address: { label: string; city: string },
  presetName: (preset: AddressLabelPreset) => string
): string {
  const preset = addressLabelPreset(address.label);
  if (preset) return presetName(preset);
  // A legacy key outside the preset list is still a key, not a name.
  if (LEGACY_KEY.test(address.label.trim())) return address.city;
  return address.label.trim() || address.city;
}
