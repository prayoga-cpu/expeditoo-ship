import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import type { User } from "../../types";

import { UsersTable } from "../UsersTable";

// See radix-dialogs-in-jsdom (project memory): the dropdown menus this table
// renders (row actions, sort field) need these even when never opened.
beforeEach(() => {
  window.HTMLElement.prototype.hasPointerCapture ??= () => false;
  window.HTMLElement.prototype.setPointerCapture ??= () => {};
  window.HTMLElement.prototype.releasePointerCapture ??= () => {};
  window.HTMLElement.prototype.scrollIntoView ??= () => {};
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const SHIPPER_ONLY: User = {
  id: "u1",
  name: "Just Signed Up",
  email: "shipper@example.com",
  role: "shipper",
  roles: ["shipper"],
  status: "active",
  joinDate: "2026-01-01",
  lastLoginAt: null,
  origin: "expeditoo",
  impersonateBlocked: null,
  deleteBlocked: null,
  suspendBlocked: null,
};

const ONE_MANAGEABLE: User = {
  ...SHIPPER_ONLY,
  id: "u2",
  name: "Approved Carrier",
  email: "carrier@example.com",
  role: "carrier",
  // KYC approval grants both together (carrier.service.ts) — this is the
  // shape every approved account actually has.
  roles: ["shipper", "carrier", "driver"],
};

const MULTI: User = {
  ...SHIPPER_ONLY,
  id: "u3",
  name: "Multi Role",
  email: "multi@example.com",
  role: "admin",
  roles: ["shipper", "carrier", "admin"],
};

function renderTable(
  users: User[],
  onRemoveRole?: (
    user: User,
    role: string
  ) => Promise<{ success: boolean; message: string }>
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={en}>
        <UsersTable users={users} onRemoveRole={onRemoveRole} />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe("UsersTable role column", () => {
  it("hides the shipper chip — every signup holds it and it manages nothing", () => {
    renderTable([MULTI]);

    expect(screen.queryByText("Shipper")).not.toBeInTheDocument();
  });

  it("merges carrier and driver into a single Driver chip", () => {
    renderTable([ONE_MANAGEABLE]);

    expect(screen.getAllByText("Driver")).toHaveLength(1);
    expect(screen.queryByText("Carrier")).not.toBeInTheDocument();
  });

  it("shows every manageable role the account holds", () => {
    renderTable([MULTI]);

    expect(screen.getByText("Driver")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("offers no remove control for an account with only one manageable role", () => {
    renderTable(
      [ONE_MANAGEABLE],
      vi.fn().mockResolvedValue({ success: true, message: "" })
    );

    expect(screen.queryByLabelText(/Remove/)).not.toBeInTheDocument();
  });

  it("removing the Driver chip calls back with the merged role", async () => {
    const onRemoveRole = vi
      .fn()
      .mockResolvedValue({ success: true, message: "" });
    renderTable([MULTI], onRemoveRole);

    fireEvent.click(screen.getByLabelText("Remove Driver"));

    expect(onRemoveRole).toHaveBeenCalledWith(MULTI, "driver");
  });

  it("does not offer a remove control when no handler is passed", () => {
    renderTable([MULTI]);

    expect(screen.queryByLabelText(/Remove/)).not.toBeInTheDocument();
  });
});
