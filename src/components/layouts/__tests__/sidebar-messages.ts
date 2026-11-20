/**
 * The sidebar toggle's copy (`common.sidebar`) ships in a patch applied to
 * messages/*.json after the code lands; a test that renders a shell merges it
 * in so it passes both before and after, and a file that already has the keys
 * wins.
 */
type Messages = Record<string, unknown> & { common: Record<string, unknown> };

const FALLBACK = {
  en: { collapse: "Collapse the menu", expand: "Expand the menu" },
  fr: { collapse: "Réduire le menu", expand: "Agrandir le menu" },
};

export function withSidebarCopy<T extends Messages>(messages: T, locale: "en" | "fr" = "en"): T {
  return {
    ...messages,
    common: {
      ...messages.common,
      sidebar: { ...FALLBACK[locale], ...(messages.common.sidebar as object | undefined) },
    },
  };
}
