import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";

import { AppVersionLink } from "../app-version";
import { APP_VERSION } from "@/lib/version";

function renderWith(locale: "en" | "fr" = "en") {
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? en : fr}
      onError={onError}
    >
      <AppVersionLink />
    </NextIntlClientProvider>
  );
  return onError;
}

describe("AppVersionLink", () => {
  it("prints the running release and points it at the changelog", () => {
    const onError = renderWith();

    const link = screen.getByRole("link");
    expect(link).toHaveTextContent(`v${APP_VERSION}`);
    expect(link).toHaveAttribute("href", "/changelog");
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("shows the version package.json ships, not a second copy of it", () => {
    // The number on screen is the one AGENTS.md §8 keeps in step with
    // CHANGELOG.md; a UI that drifted from it would be worse than none.
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8")
    ) as { version: string };

    renderWith();

    expect(screen.getByRole("link")).toHaveTextContent(`v${pkg.version}`);
  });

  it.each([
    ["en", `Version ${APP_VERSION} — see what changed`],
    ["fr", `Version ${APP_VERSION} — voir ce qui a changé`],
  ] as const)("names itself in full in %s", (locale, label) => {
    const onError = renderWith(locale);

    expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("lets the caller's palette win, for the landing footer's tokens", () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <AppVersionLink className="text-[var(--lp-faint)]" />
      </NextIntlClientProvider>
    );

    const cls = screen.getByRole("link").className;
    expect(cls).toContain("text-[var(--lp-faint)]");
    expect(cls).not.toContain("text-muted-foreground");
  });
});
