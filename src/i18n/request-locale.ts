import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveRequestLocale, type Locale } from "./config";

/**
 * The language this request is rendered in, read before any script runs:
 * the visitor's own choice (cookie), else what their device asks for
 * (`Accept-Language`), else French (docs/specs/first_paint_language_spec.md).
 *
 * Server only. Reading either store opts the route into per-request
 * rendering, which every page of this app already is for its session.
 */
export async function getRequestLocale(): Promise<Locale> {
    const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
    return resolveRequestLocale(
        cookieStore.get(LOCALE_COOKIE)?.value,
        headerStore.get("accept-language")
    );
}
