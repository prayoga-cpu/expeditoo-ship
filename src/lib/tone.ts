/**
 * The app's status tones (2.98.0).
 *
 * Status colour used to be chosen per file: forty-odd components each picked
 * their own Tailwind palette step (`bg-blue-100 text-blue-700`,
 * `text-purple-600 dark:text-purple-400`…), so "delivered" was three greens
 * and "in transit" was purple in one table and blue in the next. A component
 * now names a tone and the tokens in `globals.css` decide the colours, in
 * both themes.
 *
 * `info` is anything under way, `success` a finished good outcome, `warning`
 * something waiting on a person, `danger` a refusal or a failure, `neutral`
 * a closed or inactive state.
 */
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

/** Ground + ink + hairline: a badge, a note, a callout. */
export const TONE_SURFACE: Record<Tone, string> = {
  neutral: "tone-neutral",
  info: "tone-info",
  success: "tone-success",
  warning: "tone-warning",
  danger: "tone-danger",
};

/** The solid colour: a status dot, an accent, a progress fill. */
export const TONE_SOLID: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

/** Text or an icon on the page's own background. */
export const TONE_INK: Record<Tone, string> = {
  neutral: "text-muted-foreground",
  info: "text-info-ink",
  success: "text-success-ink",
  warning: "text-warning-ink",
  danger: "text-danger-ink",
};
