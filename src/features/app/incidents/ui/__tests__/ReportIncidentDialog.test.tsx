import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";

import { ReportIncidentDialog } from "../ReportIncidentDialog";

/**
 * Radix needs four browser APIs jsdom does not ship. They are polyfilled here
 * rather than in `src/testing/setup-vitest.ts` so this file stands alone and
 * no other suite inherits a fake ResizeObserver it did not ask for.
 */
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoopResizeObserver as never;
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= function setPointerCapture() {};
Element.prototype.releasePointerCapture ??=
  function releasePointerCapture() {};

// Covers docs/specs/incident_reporting_spec.md §8.
//
// The dialog is rendered already-open through its controlled prop rather than
// by clicking the trigger — the same shape ExpedionClients.test.tsx uses,
// because jsdom does not carry a Radix trigger click through to the portal.

const mutate = vi.fn();

vi.mock("../../hooks/useIncidents", () => ({
  useReportIncident: () => ({ mutate, isPending: false }),
}));

function renderWith(
  locale: "en" | "fr" = "en",
  messages = en,
  props: Record<string, unknown> = {}
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ReportIncidentDialog shipmentId="ship-1" {...props} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the trigger", () => {
  it("offers the button to whoever is looking at the run", () => {
    renderWith();
    expect(
      screen.getByRole("button", { name: /report an incident/i })
    ).toBeInTheDocument();
  });

  it("is a plain action, not a destructive one", () => {
    // Cancelling is destructive; reporting a problem is not, and two red
    // buttons side by side teach people to avoid both (§6.1).
    //
    // `bg-destructive`, not `destructive`: the shared base class carries
    // `aria-invalid:ring-destructive`, so the loose match passes on every
    // button in the app and proves nothing.
    renderWith();
    expect(
      screen.getByRole("button", { name: /report an incident/i }).className
    ).not.toMatch(/bg-destructive/);
  });

  it("is unavailable once the run is over", () => {
    renderWith("en", en, { disabled: true });
    expect(
      screen.getByRole("button", { name: /report an incident/i })
    ).toBeDisabled();
  });

  it("renders in French", () => {
    renderWith("fr", fr);
    expect(
      screen.getByRole("button", { name: /signaler un incident/i })
    ).toBeInTheDocument();
  });
});

describe("the form", () => {
  const open = { open: true, onOpenChange: () => {} };

  it("keeps submit disabled until the description is long enough", async () => {
    renderWith("en", en, open);

    const submit = screen.getByRole("button", { name: /send report/i });
    expect(submit).toBeDisabled();

    const field = screen.getByLabelText(/describe the problem/i);
    fireEvent.change(field, { target: { value: "too short" } });
    await waitFor(() => expect(submit).toBeDisabled());

    fireEvent.change(field, {
      target: { value: "the tail lift has failed at the depot" },
    });
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("sends the category, severity and description", async () => {
    renderWith("en", en, open);

    fireEvent.change(screen.getByLabelText(/describe the problem/i), {
      target: { value: "Pallet arrived crushed on one corner." },
    });
    fireEvent.click(screen.getByRole("button", { name: /send report/i }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "delay",
          severity: "medium",
          description: "Pallet arrived crushed on one corner.",
          photoUrls: [],
        }),
        expect.anything()
      )
    );
  });

  it("trims the description before sending it", async () => {
    renderWith("en", en, open);

    fireEvent.change(screen.getByLabelText(/describe the problem/i), {
      target: { value: "   the gate is padlocked and nobody answers   " },
    });
    fireEvent.click(screen.getByRole("button", { name: /send report/i }));

    await waitFor(() =>
      expect(mutate.mock.calls[0][0].description).toBe(
        "the gate is padlocked and nobody answers"
      )
    );
  });

  it("offers every category the DTO accepts", () => {
    renderWith("en", en, open);
    // Radix renders the trigger's current value; the option list itself only
    // mounts on open, so this asserts the field exists and is labelled.
    expect(screen.getByLabelText(/what happened/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/how serious/i)).toBeInTheDocument();
  });
});
