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
  driverApplication: null,
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
  // Approval grants the one role the file's kind earns (driver_types_spec.md §2).
  roles: ["shipper", "carrier"],
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

  it("shows the in-house driver and the carrier as two different chips", () => {
    renderTable([
      { ...ONE_MANAGEABLE, roles: ["shipper", "driver"] },
      { ...ONE_MANAGEABLE, id: "u4", email: "c@example.com", roles: ["shipper", "carrier"] },
    ]);

    expect(screen.getByText("In-house driver")).toBeInTheDocument();
    expect(screen.getByText("Carrier")).toBeInTheDocument();
  });

  it("shows every manageable role the account holds", () => {
    renderTable([MULTI]);

    expect(screen.getByText("Carrier")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("offers no remove control for an account with only one manageable role", () => {
    renderTable(
      [ONE_MANAGEABLE],
      vi.fn().mockResolvedValue({ success: true, message: "" })
    );

    expect(screen.queryByLabelText(/Remove/)).not.toBeInTheDocument();
  });

  it("removing the Carrier chip calls back with that role", async () => {
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

  describe("driver application chip", () => {
    const applicant = (driverApplication: User["driverApplication"]): User => ({
      ...SHIPPER_ONLY,
      id: "u9",
      name: "Jean Masson",
      email: "jean@example.com",
      driverApplication,
    });

    it("says an applicant is waiting for review, and links to the list", () => {
      renderTable([applicant("submitted")]);

      const chip = screen.getByText("Driver application · to review");
      expect(chip.closest("a")).toHaveAttribute(
        "href",
        "/admin/drivers?tab=applications"
      );
    });

    it("says a file under review is under review", () => {
      renderTable([applicant("under_review")]);

      expect(
        screen.getByText("Driver application · under review")
      ).toBeInTheDocument();
    });

    it("shows a started but unsent file, quietly", () => {
      renderTable([applicant("draft")]);

      expect(screen.getByText("Driver file not sent")).toBeInTheDocument();
    });

    it.each(["approved", "rejected", "suspended", "deregistered", null] as const)(
      "shows no chip for %s",
      (state) => {
        renderTable([applicant(state)]);

        expect(screen.queryByText(/Driver application|Driver file/)).toBeNull();
      }
    );
  });
});
