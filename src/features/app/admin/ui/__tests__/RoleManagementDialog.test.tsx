import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import type { User } from "../../types";

import { RoleManagementDialog } from "../RoleManagementDialog";

// See radix-dialogs-in-jsdom (project memory): the dialog and select
// this renders need these even when the select is never opened.
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

const ONE_MANAGEABLE: User = {
  id: "u2",
  name: "Approved Carrier",
  email: "carrier@example.com",
  role: "carrier",
  // Approval grants the one role the file's kind earns (driver_types_spec.md §2).
  roles: ["shipper", "carrier"],
  status: "active",
  joinDate: "2026-01-01",
  lastLoginAt: null,
  origin: "expeditoo",
  driverApplication: null,
  impersonateBlocked: null,
  deleteBlocked: null,
  suspendBlocked: null,
};

const MULTI: User = {
  ...ONE_MANAGEABLE,
  id: "u3",
  name: "Multi Role",
  email: "multi@example.com",
  role: "admin",
  roles: ["shipper", "carrier", "admin"],
};

function renderDialog({
  user,
  onRemoveRole,
  onUpdateRole = vi.fn(),
}: {
  user: User | null;
  onRemoveRole?: (
    user: User,
    role: string
  ) => Promise<{ success: boolean; message: string }>;
  onUpdateRole?: (role: string) => void;
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <RoleManagementDialog
        open
        onOpenChange={() => {}}
        user={user}
        onUpdateRole={onUpdateRole}
        onRemoveRole={onRemoveRole}
        isUpdating={false}
      />
    </NextIntlClientProvider>
  );
}

describe("RoleManagementDialog", () => {
  it("shows the carrier chip and hides shipper", () => {
    renderDialog({ user: ONE_MANAGEABLE });

    expect(screen.getAllByText("Carrier")).toHaveLength(1);
    expect(screen.queryByText("Shipper")).not.toBeInTheDocument();
    expect(screen.queryByText("In-house driver")).not.toBeInTheDocument();
  });

  it("offers no remove control when only one manageable role is held", () => {
    renderDialog({
      user: ONE_MANAGEABLE,
      onRemoveRole: vi.fn().mockResolvedValue({ success: true, message: "" }),
    });

    expect(screen.queryByLabelText(/Remove/)).not.toBeInTheDocument();
  });

  it("removing the Carrier chip calls back with that role", async () => {
    const onRemoveRole = vi
      .fn()
      .mockResolvedValue({ success: true, message: "" });
    renderDialog({ user: MULTI, onRemoveRole });

    fireEvent.click(screen.getByLabelText("Remove Carrier"));

    expect(onRemoveRole).toHaveBeenCalledWith(MULTI, "carrier");
  });

  it("offers only roles the account does not already hold", () => {
    renderDialog({ user: MULTI });

    // MULTI already holds "carrier" and "admin" — the add dropdown's
    // placeholder is still the only assignable-role text on screen, since
    // Radix only renders the option list once the select is opened.
    expect(screen.getByText("Select new role to assign")).toBeInTheDocument();
  });

  it("shows nothing to add once every manageable role is held", () => {
    const everyRole: User = {
      ...MULTI,
      roles: ["shipper", "carrier", "driver", "operator", "support", "finance", "admin"],
    };
    renderDialog({ user: everyRole });

    expect(
      screen.queryByText("Select new role to assign")
    ).not.toBeInTheDocument();
  });

  it("says an in-house driver is created with a file, once that role is picked", async () => {
    // Radix renders the option list only when opened, so pick through the select.
    const onUpdateRole = vi.fn();
    renderDialog({ user: { ...ONE_MANAGEABLE, roles: ["shipper"] }, onUpdateRole });

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "In-house driver" }));

    expect(screen.getByText(/in-house driver: creates/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open applications" })
    ).toHaveAttribute("href", "/admin/drivers?tab=applications");

    fireEvent.click(screen.getByRole("button", { name: "Assign Role" }));
    expect(onUpdateRole).toHaveBeenCalledWith("driver");
  });

  it("offers both driver roles, and the others, to someone with none", async () => {
    renderDialog({ user: { ...ONE_MANAGEABLE, roles: ["shipper"] } });

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });

    for (const name of ["In-house driver", "Carrier", "Operator", "Admin"]) {
      expect(await screen.findByRole("option", { name })).toBeInTheDocument();
    }
  });

  it("shows no driver-file hint before a driver role is picked", () => {
    renderDialog({ user: { ...ONE_MANAGEABLE, roles: ["shipper"] } });

    expect(screen.queryByRole("link", { name: "Open applications" })).not.toBeInTheDocument();
  });
});
