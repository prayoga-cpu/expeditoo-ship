import { getRequestConfig } from "next-intl/server";
import { defaultLocale } from "./config";

export default getRequestConfig(async () => {
    // In a real app, you might get this from cookies/headers
    // For now, we use default locale for SSR and let client override
    const locale = defaultLocale;

    return {
        locale,
        messages: (await import(`../../messages/${locale}.json`)).default,
    };
});
