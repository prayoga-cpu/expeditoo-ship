import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";

import { SidebarRoleBadge } from "../SidebarRoleBadge";

const auth: { user: { roles: string[] } | null; isLoading: boolean } = {
  user: { roles: ["shipper"] },
  isLoading: false,
};

vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));

function renderWith(
  locale: "en" | "fr" = "en",
  messages: typeof en | typeof fr = en
) {
  const onError = vi.fn<(error: Error) => void>();
  render(
    <NextIntlClientProvider locale={locale} messages={messages} onError={onError}>
      <SidebarRoleBadge />
    </NextIntlClientProvider>
  );
  return onError;
}

describe("SidebarRoleBadge", () => {
  it.each([
    ["admin", "en", "Admin"],
    ["admin", "fr", "Admin"],
    ["operator", "en", "Operator"],
    ["operator", "fr", "Opérateur"],
    ["driver", "en", "Driver"],
    ["driver", "fr", "Chauffeur"],
    ["shipper", "en", "Shipper"],
    ["shipper", "fr", "Expéditeur"],
    ["support", "en", "Support"],
    ["support", "fr", "Support"],
    ["finance", "en", "Finance"],
    ["finance", "fr", "Finance"],
    ["carrier", "en", "Driver"],
    ["carrier", "fr", "Chauffeur"],
  ] as const)("labels %s in %s", (role, locale, label) => {
    auth.user = { roles: [role] };
    auth.isLoading = false;

    const onError = renderWith(locale, locale === "en" ? en : fr);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(onError.mock.calls.map(([e]) => e.message)).toEqual([]);
  });

  it("shows the strongest role, not whichever the join returned first", () => {
    auth.user = { roles: ["shipper", "admin"] };
    auth.isLoading = false;

    renderWith();

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.queryByText("Shipper")).not.toBeInTheDocument();
  });

  it("says user, not a role, for an account granted none", () => {
    auth.user = { roles: [] };
    auth.isLoading = false;

    renderWith();

    expect(screen.getByText("User")).toBeInTheDocument();
  });

  it("renders nothing while the session loads, rather than flashing a wrong role", () => {
    auth.user = null;
    auth.isLoading = true;

    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <SidebarRoleBadge />
      </NextIntlClientProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no session at all", () => {
    auth.user = null;
    auth.isLoading = false;

    const { container } = render(
      <NextIntlClientProvider locale="en" messages={en}>
        <SidebarRoleBadge />
      </NextIntlClientProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });
});
