import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";

import WelcomePage from "../page";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <WelcomePage />
    </NextIntlClientProvider>
  );
}

describe("WelcomePage", () => {
  afterEach(() => {
    window.localStorage.clear();
    push.mockClear();
  });

  it("offers both choices", () => {
    renderPage();

    expect(screen.getByText(en.auth.welcome.shipTitle)).toBeInTheDocument();
    expect(screen.getByText(en.auth.welcome.driveTitle)).toBeInTheDocument();
  });

  it("shipping something sets user mode and lands on /home", () => {
    renderPage();

    screen.getByText(en.auth.welcome.shipTitle).closest("button")!.click();

    expect(window.localStorage.getItem("expeditoo-active-access")).toBe(
      "user"
    );
    expect(push).toHaveBeenCalledWith("/home");
  });

  it("wanting to drive sets carrier mode and starts the KYC application", () => {
    renderPage();

    screen.getByText(en.auth.welcome.driveTitle).closest("button")!.click();

    expect(window.localStorage.getItem("expeditoo-active-access")).toBe(
      "carrier"
    );
    expect(push).toHaveBeenCalledWith("/carrier/application");
  });
});
