/**
 * The two kinds of driver, in the words the client uses for them
 * (driver_types_spec.md §1): « Particulier » is the in-house Expeditop driver
 * (`carriers.kind = 'private'`, role `driver`), « Professionnel » the outside
 * carrier (`professional`, role `carrier`).
 *
 * One vocabulary for the admin table, its filter, the file, the editor and the
 * alert mail. It lives here rather than in `messages/*.json` because the mail
 * is rendered on the server with no locale, and a second copy is how the admin
 * came to read « Chauffeur interne » in one place and « Transporteur » in
 * another for the same two things.
 */
export const CARRIER_KINDS = ["private", "professional"] as const;

export type CarrierKind = (typeof CARRIER_KINDS)[number];

const LABELS: Record<CarrierKind, { fr: string; en: string }> = {
  private: { fr: "Particulier (interne)", en: "Private (in-house)" },
  professional: { fr: "Professionnel", en: "Professional" },
};

/** French unless the locale is English — the same fallback the app has. */
export function carrierKindLabel(
  kind: CarrierKind | null | undefined,
  locale: string = "fr"
): string {
  const label = LABELS[kind ?? "professional"];
  return locale.startsWith("en") ? label.en : label.fr;
}
