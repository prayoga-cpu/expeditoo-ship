import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import { CreateDriverDialog } from "../CreateDriverDialog";

/**
 * driver_types_spec.md §4: an in-house driver is added either from a registered
 * account or by invitation, and the form asks for no company, SIRET or legal form.
 */

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

const onCreate = vi.fn();

function renderDialog() {
  onCreate.mockReset();
  onCreate.mockResolvedValue({
    carrierId: "c1",
    userId: "u1",
    name: "Jane",
    email: "jane@example.com",
    accountCreated: true,
  });
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <CreateDriverDialog open onOpenChange={() => {}} onCreate={onCreate} isCreating={false} />
    </NextIntlClientProvider>
  );
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("CreateDriverDialog", () => {
  it("asks for no company, SIRET or legal form", () => {
    renderDialog();

    expect(screen.queryByLabelText("Company name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("SIRET")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Legal form")).not.toBeInTheDocument();
  });

  it("starts on the invitation and asks for the person's name", () => {
    renderDialog();

    expect(screen.getByRole("radio", { name: /Not registered yet/ })).toBeChecked();
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
  });

  it("drops the name for a registered account, which keeps its own", () => {
    renderDialog();

    fireEvent.click(screen.getByRole("radio", { name: /Already registered/ }));

    expect(screen.queryByLabelText("Full name")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("sends the mode with the form, and tells the admin an invitation went out", async () => {
    renderDialog();
    type("Full name", "Jane Driver");
    type("Email", "jane@example.com");
    type("Contact phone", "06 12 34 56 78");
    type("Address", "12 rue Exemple");
    type("City", "Lyon");
    type("Postal code", "69000");
    type("Max load (kg)", "1200");
    type("Plate number", "AB-123-CD");
    // The vehicle type is a Radix select; open it from the keyboard.
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    fireEvent.click((await screen.findAllByRole("option"))[0]);

    fireEvent.click(screen.getByRole("button", { name: "Add driver" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "invite",
        name: "Jane Driver",
        email: "jane@example.com",
        vehicle: expect.objectContaining({ maxWeightKg: 1200, plateNumber: "AB-123-CD" }),
      })
    );
    const sent = onCreate.mock.calls[0][0];
    expect(sent).not.toHaveProperty("companyName");
    expect(sent).not.toHaveProperty("siret");
  });
});
