import { getRequestConfig } from "next-intl/server";
import { getRequestLocale } from "./request-locale";

export default getRequestConfig(async () => {
    // The visitor's cookie, else their device's language, else French — the
    // same answer the root layout renders `<html lang>` with.
    const locale = await getRequestLocale();

    return {
        locale,
        messages: (await import(`../../messages/${locale}.json`)).default,
    };
});
