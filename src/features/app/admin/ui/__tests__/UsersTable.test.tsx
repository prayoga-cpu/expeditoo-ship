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

const SINGLE: User = {
  id: "u1",
  name: "Single Role",
  email: "single@example.com",
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

const MULTI: User = {
  ...SINGLE,
  id: "u2",
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
  it("shows every role the account holds as its own chip", () => {
    renderTable([MULTI]);

    expect(screen.getByText("Shipper")).toBeInTheDocument();
    expect(screen.getByText("Carrier")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("offers no remove control for an account with only one role", () => {
    renderTable([SINGLE], vi.fn().mockResolvedValue({ success: true, message: "" }));

    expect(screen.queryByLabelText(/Remove/)).not.toBeInTheDocument();
  });

  it("removing a chip calls back with that user and role", async () => {
    const onRemoveRole = vi
      .fn()
      .mockResolvedValue({ success: true, message: "" });
    renderTable([MULTI], onRemoveRole);

    fireEvent.click(screen.getByLabelText("Remove Carrier"));

    expect(onRemoveRole).toHaveBeenCalledWith(MULTI, "carrier");
  });

  it("does not offer a remove control when no handler is passed", () => {
    renderTable([MULTI]);

    expect(screen.queryByLabelText(/Remove/)).not.toBeInTheDocument();
  });
});
