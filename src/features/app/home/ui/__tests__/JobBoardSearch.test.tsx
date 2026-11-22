import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";

/**
 * The search card on the board (board_route_search_spec.md §12): what
 * « Rechercher » asks the API and writes to the URL, and the way out of an
 * empty answer. Controls are found by id or test id, so this passes before
 * and after the copy patch.
 */

const nav = vi.hoisted(() => ({
  replace: vi.fn(),
  search: "",
}));
const browse = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  usePathname: () => "/expedion",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/features/app/listing/api/listings.api", () => ({
  listingsApi: { browse },
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: { id: "u1", roles: ["carrier"] } }),
}));
vi.mock("@/lib/use-active-access-mode", () => ({
  useActiveAccessMode: () => ({ mode: "carrier", qualifiedModes: ["carrier"], setMode: vi.fn() }),
}));
vi.mock("../BoardMap", () => ({ BoardMap: () => null }));
vi.mock("../JobCard", () => ({
  JobCard: ({ job }: { job: { title: string } }) => <article>{job.title}</article>,
}));
vi.mock("@/components/ui/city-field", () => ({
  CityField: ({
    id,
    value,
    onChange,
  }: {
    id: string;
    value: { label: string } | null;
    onChange: (place: { label: string; lat: number; lng: number } | null) => void;
  }) => (
    <input
      id={id}
      value={value?.label ?? ""}
      onChange={(event) =>
        onChange(
          event.target.value === "Paris" ? { label: "Paris", lat: 48.85, lng: 2.35 } : null
        )
      }
    />
  ),
}));

import { JobBoard } from "../JobBoard";

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris" onError={() => {}}>
        <JobBoard />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement;
const type = (id: string, value: string) =>
  fireEvent.change(field(id), { target: { value } });
const lastBrowse = () => browse.mock.calls.at(-1)?.[0] as Record<string, unknown>;
const lastUrl = () => nav.replace.mock.calls.at(-1)?.[0] as string;

beforeEach(() => {
  nav.replace.mockClear();
  nav.search = "";
  browse.mockReset();
  browse.mockResolvedValue({ items: [], total: 0 });
});

describe("JobBoard — the search card", () => {
  it("asks nothing new while the fields are being filled", async () => {
    renderBoard();
    await waitFor(() => expect(browse).toHaveBeenCalledTimes(1));

    type("board-title", "canapé");
    type("board-from", "Paris");

    expect(browse).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("sends the title and the place on « Rechercher », and writes them to the URL", async () => {
    renderBoard();
    type("board-title", "Canapé");
    type("board-from", "Paris");
    fireEvent.click(screen.getByTestId("board-search-submit"));

    await waitFor(() => expect(lastBrowse()).toMatchObject({ q: "Canapé" }));
    expect(lastBrowse()).toMatchObject({ fromLat: 48.85, fromLng: 2.35, radiusKm: 50, page: 1 });
    // A departure alone is « autour de »: no arrival is sent.
    expect(lastBrowse().toLat).toBeUndefined();

    const url = new URL(lastUrl(), "https://example.test");
    expect(url.pathname).toBe("/expedion");
    expect(url.searchParams.get("q")).toBe("Canapé");
    expect(url.searchParams.get("fromLabel")).toBe("Paris");
    expect(url.searchParams.get("radiusKm")).toBe("50");
  });

  it("opens on the search its URL carries", async () => {
    nav.search = "q=piano&fromLat=48.85&fromLng=2.35&fromLabel=Paris&radiusKm=100";
    renderBoard();

    expect(field("board-title")).toHaveValue("piano");
    expect(field("board-from")).toHaveValue("Paris");
    await waitFor(() => expect(lastBrowse()).toMatchObject({ q: "piano", radiusKm: 100 }));
  });

  it("offers a way out of a search that found nothing", async () => {
    nav.search = "q=introuvable";
    renderBoard();

    const clear = await screen.findByTestId("board-empty-clear");
    fireEvent.click(clear);

    // The URL, the request and the card's own fields are all emptied.
    expect(lastUrl()).toBe("/expedion");
    await waitFor(() => expect(lastBrowse().q).toBeUndefined());
    expect(field("board-title")).toHaveValue("");
  });

  it("has no way-out button on a board that is simply empty", async () => {
    renderBoard();
    await waitFor(() => expect(browse).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByTestId("board-empty-clear")).not.toBeInTheDocument()
    );
  });

  it("clears the card's own fields on « Effacer » and keeps the rest", async () => {
    nav.search = "q=piano&maxWeightKg=500";
    renderBoard();

    fireEvent.click(screen.getByTestId("board-search-clear"));

    await waitFor(() => expect(lastBrowse().q).toBeUndefined());
    expect(lastBrowse()).toMatchObject({ maxWeightKg: 500 });
    expect(lastUrl()).toBe("/expedion?maxWeightKg=500");
  });
});
