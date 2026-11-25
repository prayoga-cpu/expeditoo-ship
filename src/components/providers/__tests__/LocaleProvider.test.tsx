import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";
import { LOCALE_COOKIE, LOCALE_STORAGE_KEY, readLocaleCookie } from "@/i18n/config";

import { LocaleProvider, useLocale } from "../LocaleProvider";

/**
 * 2.96.0 #36. The provider used to render its children bare while it read
 * the stored locale, then wrap them in `NextIntlClientProvider`: a different
 * root element, so React unmounted and remounted the whole app right after
 * the first paint (a tap on the bar in that window was lost), and the server,
 * stuck in the bare branch, rendered nothing at all.
 */

let mounts = 0;

function Probe() {
  const t = useTranslations("common.navigation");
  const { locale, isLoading } = useLocale();
  useEffect(() => {
    mounts += 1;
  }, []);
  return (
    <p data-testid="probe" data-locale={locale} data-loading={String(isLoading)}>
      {t("home")}
    </p>
  );
}

beforeEach(() => {
  mounts = 0;
  window.localStorage.clear();
  document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
});

describe("LocaleProvider", () => {
  it("renders translated content on the server, in the default locale", () => {
    const html = renderToString(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    );
    expect(html).toContain(fr.common.navigation.home);
    expect(html).toContain('data-loading="true"');
  });

  it("switches to a stored English without remounting what is inside", () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en");
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    );

    const probe = screen.getByTestId("probe");
    expect(probe).toHaveTextContent(en.common.navigation.home);
    expect(probe).toHaveAttribute("data-locale", "en");
    expect(probe).toHaveAttribute("data-loading", "false");
    // The same node and one mount: the switch re-rendered in place.
    expect(mounts).toBe(1);
  });

  it("keeps the same nodes through a later switch made in the app", () => {
    let switchTo: ((locale: "fr" | "en") => void) | undefined;
    function Switcher() {
      switchTo = useLocale().setLocale;
      return null;
    }
    render(
      <LocaleProvider>
        <Switcher />
        <Probe />
      </LocaleProvider>
    );
    const before = screen.getByTestId("probe");

    act(() => switchTo?.("en"));
    expect(screen.getByTestId("probe")).toBe(before);
    expect(before).toHaveTextContent(en.common.navigation.home);

    act(() => switchTo?.("fr"));
    expect(before).toHaveTextContent(fr.common.navigation.home);
    expect(mounts).toBe(1);
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("fr");
  });

  it("follows <html lang> to the locale on screen", () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en");
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    );
    expect(document.documentElement.lang).toBe("en");
  });

  // docs/specs/first_paint_language_spec.md
  it("renders the language the server settled on, with no French first", () => {
    const html = renderToString(
      <LocaleProvider initialLocale="en">
        <Probe />
      </LocaleProvider>
    );
    expect(html).toContain(en.common.navigation.home);
    expect(html).not.toContain(fr.common.navigation.home);
  });

  it("keeps the server's language on mount when the browser holds no choice", () => {
    document.cookie = `${LOCALE_COOKIE}=en; Path=/`;
    render(
      <LocaleProvider initialLocale="en">
        <Probe />
      </LocaleProvider>
    );
    expect(screen.getByTestId("probe")).toHaveAttribute("data-locale", "en");
    expect(screen.getByTestId("probe")).toHaveTextContent(en.common.navigation.home);
  });

  it("copies a choice made before the cookie existed into the cookie", () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en");
    expect(readLocaleCookie()).toBeNull();
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    );
    expect(readLocaleCookie()).toBe("en");
  });

  it("reads the device when the server had no header to go on", () => {
    const languages = vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["en-GB"]);
    render(
      <LocaleProvider>
        <Probe />
      </LocaleProvider>
    );
    languages.mockRestore();
    expect(screen.getByTestId("probe")).toHaveAttribute("data-locale", "en");
  });

  it("writes the cookie when a person switches language", () => {
    let switchTo: ((locale: "fr" | "en") => void) | undefined;
    function Switcher() {
      switchTo = useLocale().setLocale;
      return null;
    }
    render(
      <LocaleProvider>
        <Switcher />
      </LocaleProvider>
    );
    act(() => switchTo?.("en"));
    expect(readLocaleCookie()).toBe("en");
  });
});
