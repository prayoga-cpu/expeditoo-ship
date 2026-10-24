import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "../../../../../../messages/en.json";
import fr from "../../../../../../messages/fr.json";
import { ApiError } from "@/lib/fetcher";
import { formatCurrency } from "@/lib/currency";
import type { Shipment, ShipmentStatus } from "@/features/app/deliveries/api";

/**
 * « En transit » (client_feedback_2026_10_spec.md §5): the real panel and
 * hooks against a stubbed `/api/shipments`, so the status set asked for, the
 * pill wording and the filtering are all the screen's own.
 */

const api = vi.hoisted(() => ({ list: vi.fn() }));
const auth = vi.hoisted(() => ({
  user: { id: "user_c" } as { id: string } | null,
  isLoading: false,
}));

vi.mock("@/features/app/deliveries/api", () => ({ deliveriesApi: api }));
vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));
// The Lottie player behind the loader needs IntersectionObserver.
vi.mock("@/components/ui/page-loader", () => ({
  PageLoader: () => <div data-testid="loader" />,
}));

import { ActiveTripsPanel } from "../ActiveTripsPanel";

/** The amount as Testing Library reads it: its no-break space collapsed. */
const euros = (cents: number) => formatCurrency(cents).replace(/\s/g, " ");

const PICKUP = "2026-10-22T08:00:00.000Z";

function shipment(
  id: string,
  status: ShipmentStatus,
  extra: Partial<Shipment> & { listing?: Record<string, unknown> | null } = {}
): Shipment {
  return {
    id,
    listingId: `job_${id}`,
    offerId: `off_${id}`,
    shipperId: "user_r",
    carrierId: "user_c",
    driverId: null,
    status,
    pickupAddress: "1 rue de la Gare, 14000 Caen",
    dropoffAddress: "2 place du Marché, 35000 Rennes",
    priceCents: 18_000,
    scheduledPickup: PICKUP,
    listing: {
      id: `job_${id}`,
      reference: 100042,
      title: "Armoire normande",
      status: "in_progress",
      pickupCity: "Caen",
      dropoffCity: "Rennes",
    },
    ...extra,
  } as Shipment;
}

function renderPanel(locale: "fr" | "en" = "fr") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onError = vi.fn<(error: Error) => void>();
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider
        locale={locale}
        messages={locale === "fr" ? fr : en}
        onError={onError}
      >
        <ActiveTripsPanel />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
  return onError;
}

const page = (items: Shipment[]) => ({ items, total: items.length, page: 1, limit: 50 });

beforeEach(() => {
  api.list.mockReset();
  auth.user = { id: "user_c" };
  auth.isLoading = false;
});

describe("ActiveTripsPanel", () => {
  it("asks for the runs awarded and not finished", async () => {
    api.list.mockResolvedValue(page([]));
    renderPanel();

    await screen.findByText("Aucune course en transit");
    expect(api.list).toHaveBeenCalledWith({
      status: "PENDING,ASSIGNED,PICKED_UP,IN_TRANSIT",
      limit: 50,
    });
  });

  it("shows the status in the client's words, the job, the cities, the price and the pickup", async () => {
    api.list.mockResolvedValue(page([shipment("shp_1", "PICKED_UP")]));
    const onError = renderPanel();

    const title = await screen.findByText("Armoire normande");
    expect(screen.getByText("En retrait")).toBeInTheDocument();
    expect(screen.getByText("Réf. CAE-REN-100042")).toBeInTheDocument();
    expect(screen.getByText("Caen")).toBeInTheDocument();
    expect(screen.getByText("Rennes")).toBeInTheDocument();
    expect(screen.getByText("Prix convenu")).toBeInTheDocument();
    expect(screen.getByText(euros(18_000))).toBeInTheDocument();
    expect(
      screen.getByText(
        `Enlèvement prévu le ${format(new Date(PICKUP), "EEE d MMM, HH:mm", { locale: frLocale })}`
      )
    ).toBeInTheDocument();
    expect(title.closest("a")).toHaveAttribute("href", "/deliveries/shp_1");
    expect(onError).not.toHaveBeenCalled();
  });

  it.each<[ShipmentStatus, string]>([
    ["PENDING", "En attente"],
    ["ASSIGNED", "En préparation"],
    ["IN_TRANSIT", "En cours de livraison"],
  ])("labels %s as « %s »", async (status, label) => {
    api.list.mockResolvedValue(page([shipment("shp_1", status)]));
    renderPanel();

    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it("leaves out runs the carrier only requested", async () => {
    api.list.mockResolvedValue(
      page([
        shipment("shp_1", "ASSIGNED"),
        shipment("shp_2", "ASSIGNED", {
          shipperId: "user_c",
          carrierId: "user_other",
          listing: {
            id: "job_shp_2",
            reference: 100043,
            title: "Mon propre canapé",
            status: "awarded",
          },
        }),
      ])
    );
    renderPanel();

    expect(await screen.findByText("Armoire normande")).toBeInTheDocument();
    expect(screen.queryByText("Mon propre canapé")).not.toBeInTheDocument();
  });

  it("falls back to the run's addresses when the job carries no city", async () => {
    api.list.mockResolvedValue(
      page([
        shipment("shp_1", "ASSIGNED", {
          listing: { id: "job_shp_1", reference: 100042, title: "Armoire normande", status: "awarded" },
        }),
      ])
    );
    renderPanel();

    expect(await screen.findByText("1 rue de la Gare, 14000 Caen")).toBeInTheDocument();
    expect(screen.getByText("2 place du Marché, 35000 Rennes")).toBeInTheDocument();
  });

  it("reads in English", async () => {
    api.list.mockResolvedValue(page([shipment("shp_1", "PICKED_UP")]));
    const onError = renderPanel("en");

    expect(await screen.findByText("At pickup")).toBeInTheDocument();
    expect(screen.getByText("Agreed price")).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
  });

  it("has its own empty state", async () => {
    api.list.mockResolvedValue(page([]));
    renderPanel();

    expect(await screen.findByText("Aucune course en transit")).toBeInTheDocument();
  });

  it("says the list failed, and tries again on « Réessayer »", async () => {
    api.list
      .mockRejectedValueOnce(new ApiError("INTERNAL_ERROR", "boom", 500))
      .mockResolvedValueOnce(page([shipment("shp_1", "ASSIGNED")]));
    renderPanel();

    expect(await screen.findByText("Impossible de charger cette liste")).toBeInTheDocument();
    expect(screen.queryByText("Aucune course en transit")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));

    expect(await screen.findByText("Armoire normande")).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it("waits for the session rather than flashing the empty state", () => {
    auth.user = null;
    auth.isLoading = true;
    api.list.mockResolvedValue(page([shipment("shp_1", "ASSIGNED")]));
    renderPanel();

    expect(screen.getByTestId("loader")).toBeInTheDocument();
    expect(screen.queryByText("Aucune course en transit")).not.toBeInTheDocument();
  });
});
