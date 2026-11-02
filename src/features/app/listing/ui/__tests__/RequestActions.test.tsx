import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/fetcher";
import fr from "../../../../../../messages/fr.json";
import type { Job } from "../../types";

/**
 * A request that is live or has ended keeps a way on: change it, call it off,
 * follow its delivery or post it again (docs/specs/no_dead_ends_spec.md §2–3).
 */

// jsdom lacks what Radix's dialog reaches for.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

const api = vi.hoisted(() => ({
  unpublish: vi.fn(),
  cancel: vi.fn(),
  repost: vi.fn(),
}));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("../../api/listings.api", () => ({ listingsApi: api }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { RequestActions } from "../RequestActions";

const O = fr.myJobs.owner;

type Shape = Pick<Job, "id" | "status" | "origin" | "offersCount">;
const job = (over: Partial<Shape> = {}): Shape => ({
  id: "job-1",
  status: "open",
  origin: "direct",
  offersCount: 0,
  ...over,
});

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("RequestActions — a live request", () => {
  it("offers to change it or call it off", () => {
    wrap(<RequestActions job={job()} />);

    expect(screen.getByRole("button", { name: O.edit })).toBeTruthy();
    expect(screen.getByRole("button", { name: O.cancel })).toBeTruthy();
  });

  it("takes it back to a draft and opens it in the form", async () => {
    api.unpublish.mockResolvedValue({ withdrawnOffers: 0 });
    wrap(<RequestActions job={job()} confirming="edit" onConfirmingChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: O.editConfirm }));

    await waitFor(() => expect(api.unpublish.mock.calls[0]?.[0]).toBe("job-1"));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/create?draft=job-1"));
  });

  it("says, before anything happens, that the offers received will go", () => {
    wrap(
      <RequestActions job={job({ offersCount: 3 })} confirming="edit" onConfirmingChange={() => {}} />
    );

    expect(
      screen.getByText(/Les 3 offres reçues seront retirées et leurs transporteurs prévenus/)
    ).toBeTruthy();
  });

  it("calls it off on confirmation", async () => {
    api.cancel.mockResolvedValue({ deleted: false });
    wrap(<RequestActions job={job()} confirming="cancel" onConfirmingChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: O.cancelConfirm }));

    await waitFor(() => expect(api.cancel.mock.calls[0]?.[0]).toBe("job-1"));
    expect(toast.success).toHaveBeenCalledWith(O.done.cancelled);
  });

  it("says why when an award landed first, and points at the delivery", async () => {
    api.cancel.mockRejectedValue(new ApiError("CANCEL_VIA_SHIPMENT", "", 409));
    wrap(<RequestActions job={job()} confirming="cancel" onConfirmingChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: O.cancelConfirm }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        O.errors.CANCEL_VIA_SHIPMENT,
        expect.objectContaining({ action: expect.objectContaining({ label: O.trackDelivery }) })
      )
    );
  });
});

describe("RequestActions — after the award, and at the end", () => {
  it("points a taken request at its delivery, where cancelling goes from there", () => {
    wrap(<RequestActions job={job({ status: "awarded" })} />);

    expect(screen.getByRole("link", { name: O.trackDelivery }).getAttribute("href")).toBe(
      "/deliveries"
    );
    expect(screen.queryByRole("button", { name: O.cancel })).toBeNull();
  });

  it.each(["expired", "cancelled", "completed"] as const)(
    "posts a %s request again, as a draft opened in the form",
    async (status) => {
      api.repost.mockResolvedValue({ id: "copy-9" });
      wrap(<RequestActions job={job({ status })} />);

      fireEvent.click(screen.getByRole("button", { name: O.repost }));

      await waitFor(() => expect(api.repost.mock.calls[0]?.[0]).toBe("job-1"));
      await waitFor(() => expect(router.push).toHaveBeenCalledWith("/create?draft=copy-9"));
    }
  );

  it("offers nothing on an escalated job, which its client runs from Expedion", () => {
    const { container } = wrap(<RequestActions job={job({ origin: "expedion" })} />);
    expect(container.textContent).toBe("");
  });
});
