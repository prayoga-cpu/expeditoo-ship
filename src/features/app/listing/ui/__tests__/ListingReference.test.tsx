import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import { ListingReference } from "../ListingReference";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

/** listing_reference_spec.md §3 — one way to write a job's number. */

const render = (ui: React.ReactElement, locale: "fr" | "en" = "fr") =>
  rtlRender(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      {ui}
    </NextIntlClientProvider>
  );

const writeText = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("ListingReference", () => {
  it("writes the reference the way French readers expect", () => {
    render(<ListingReference reference={100042} />);

    expect(screen.getByText("Réf. 100042")).toBeInTheDocument();
  });

  it("writes it in English too", () => {
    render(<ListingReference reference={100042} />, "en");

    expect(screen.getByText("Ref. 100042")).toBeInTheDocument();
  });

  it("offers no button unless asked — a list card is already a link", () => {
    render(<ListingReference reference={100042} />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("copies the bare number, which is what every search takes", async () => {
    writeText.mockResolvedValue(undefined);
    render(<ListingReference reference={100042} copyable />);

    fireEvent.click(
      screen.getByRole("button", { name: "Copier la référence" })
    );

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Référence 100042 copiée")
    );
    expect(writeText).toHaveBeenCalledWith("100042");
  });

  it("says so when the browser refuses, rather than failing silently", async () => {
    writeText.mockRejectedValue(new Error("NotAllowedError"));
    render(<ListingReference reference={100042} copyable />);

    fireEvent.click(
      screen.getByRole("button", { name: "Copier la référence" })
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Impossible de copier la référence"
      )
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says so when there is no clipboard at all (an insecure origin)", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    render(<ListingReference reference={100042} copyable />);

    fireEvent.click(
      screen.getByRole("button", { name: "Copier la référence" })
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
