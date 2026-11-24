/**
 * The landing page's photographs (docs/specs/landing_2026_11_spec.md §6).
 *
 * Every file is in `public/images/landing/`, and `CREDITS.md` beside them
 * names its source, creator, licence and Openverse id — public domain (CC0 or
 * PDM) only, so no permission or attribution is owed, and the credit is kept
 * anyway. Sizes are the files' own: `next.config` serves images unoptimised,
 * so what is written here is what the browser downloads.
 *
 * Alt text lives in `marketing.images.*` (both catalogues).
 */
export const LANDING_IMAGES = {
  hero: { src: "/images/landing/hero.webp", width: 960, height: 1200, alt: "hero" },
  shipper: { src: "/images/landing/shipper.webp", width: 960, height: 600, alt: "shipper" },
  carrier: { src: "/images/landing/carrier.webp", width: 960, height: 600, alt: "carrier" },
  packing: { src: "/images/landing/packing.webp", width: 720, height: 540, alt: "packing" },
} as const;

export type LandingImageKey = keyof typeof LANDING_IMAGES;
