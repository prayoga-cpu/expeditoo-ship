/**
 * The landing page's photographs and its hero video
 * (docs/specs/landing_2026_11_spec.md §6).
 *
 * Every photograph is in `public/images/landing/`, and `CREDITS.md` beside
 * them names its source, creator, licence and Openverse id — public domain
 * (CC0 or PDM) only, so no permission or attribution is owed, and the credit
 * is kept anyway. Sizes are the files' own: `next.config` serves images
 * unoptimised, so what is written here is what the browser downloads.
 *
 * Alt text lives in `marketing.images.*` (both catalogues).
 */
export const LANDING_IMAGES = {
  hero: { src: "/images/landing/hero.webp", width: 960, height: 1200, alt: "hero" },
  shipper: { src: "/images/landing/shipper.webp", width: 960, height: 600, alt: "shipper" },
  carrier: { src: "/images/landing/carrier.webp", width: 960, height: 600, alt: "carrier" },
  packing: { src: "/images/landing/packing.webp", width: 720, height: 540, alt: "packing" },
  parcel: { src: "/images/landing/parcel.webp", width: 720, height: 540, alt: "parcel" },
  europe: { src: "/images/landing/europe.webp", width: 960, height: 494, alt: "europe" },
  closing: { src: "/images/landing/closing.webp", width: 960, height: 640, alt: "closing" },
} as const;

export type LandingImageKey = keyof typeof LANDING_IMAGES;

/**
 * The hero's background clip: CC0, real driving on the A6 towards Paris
 * (`public/videos/landing/CREDITS.md`). 1280×720, 10.8 s, no audio track;
 * the WebM (VP9) is listed first because it is the smaller of the two. The
 * poster is the loop's first frame, so the switch from picture to video does
 * not jump.
 */
export const LANDING_VIDEO = {
  webm: "/videos/landing/hero.webm",
  mp4: "/videos/landing/hero.mp4",
  poster: "/videos/landing/hero-poster.webp",
  width: 1280,
  height: 720,
} as const;
