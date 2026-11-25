import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LandingPage from "@/app/(marketing)/page";
import { buildCreateUrl, EXAMPLE_ROUTES } from "../../landing-search";
import { LandingSearchCard } from "../LandingSearchCard";
import { LandingRecentRequests } from "../LandingRecentRequests";

/**
 * docs/specs/landing_2026_11_spec.md — the page's sections, where its links
 * go, and the search card's one job: a `/create` link carrying four values.
 *
 * Copy is read by key (the translator below answers the key and its values),
 * so this suite does not depend on the catalogue; `LandingPage.i18n.test.tsx`
 * is the one that reads both catalogues.
 */

vi.mock("next-intl", () => {
  const t = (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key;
  return {
    useTranslations: () => Object.assign(t, { rich: t, raw: () => [], has: () => true }),
    useLocale: () => "fr",
  };
});

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const auth = { isAuthenticated: false, isLoading: false, user: null };
vi.mock("@/lib/auth-context", () => ({ useAuth: () => auth }));

vi.mock("@/components/providers/LocaleProvider", () => ({
  useLocale: () => ({ locale: "fr", setLocale: vi.fn(), isLoading: false }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", resolvedTheme: "light", setTheme: vi.fn() }),
}));

const list = vi.fn();
vi.mock("@/features/marketing/api/recent-requests.api", () => ({
  recentRequestsApi: { list: () => list() },
}));

function withClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const ITEM = {
  id: "job-1",
  reference: 100123,
  title: "Canapé 3 places",
  jobKind: "items" as const,
  pickupCity: "Paris",
  pickupCountry: "FR",
  dropoffCity: "Bruxelles",
  dropoffCountry: "BE",
  pickupFrom: "2026-11-26T08:00:00.000Z",
  pickupUntil: "2026-11-28T18:00:00.000Z",
  isFlexible: true,
  weightKg: 45,
  movingSurfaceM2: null,
  movingVolumeM3: null,
};

beforeEach(() => {
  push.mockClear();
  list.mockReset();
  list.mockResolvedValue({ items: [] });
  auth.isAuthenticated = false;
});

describe("the landing page", () => {
  it("renders its sections in order", () => {
    const { container } = withClient(<LandingPage />);

    // 2.97.0: the client's reference first (hero card, recent requests),
    // then what we move, how it works, the promises, the carriers' band, the
    // FAQ and the closing band.
    const SECTIONS = ["top", "recent", "shippers", "how", "promises", "carriers", "faq", "cta"];
    const ids = Array.from(container.querySelectorAll("main [id]"))
      .map((node) => node.id)
      .filter((id) => SECTIONS.includes(id));
    expect(ids).toEqual(SECTIONS);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("title");
    expect(container.querySelector("header")).not.toBeNull();
    expect(container.querySelector("footer")).not.toBeNull();
  });

  it("sends every « publish » door to /create", () => {
    const { container } = withClient(<LandingPage />);

    const toCreate = Array.from(container.querySelectorAll('a[href="/create"]'));
    // How it works, the shipper card, the closing band, the footer.
    expect(toCreate.length).toBeGreaterThanOrEqual(4);
  });

  it("offers the carrier's door in the audience block and the closing band", () => {
    withClient(<LandingPage />);

    const carriers = document.getElementById("carriers");
    expect(within(carriers as HTMLElement).getByRole("button", { name: "primary" })).toBeInTheDocument();
    expect(within(document.getElementById("cta") as HTMLElement).getByRole("button", { name: "primary" }))
      .toBeInTheDocument();
  });

  it("gives every photograph its alt text, and only the video's poster priority", () => {
    const { container } = withClient(<LandingPage />);

    // Outside Next the default loader rewrites `src`; the path is still in it.
    const source = (image: Element) => decodeURIComponent(image.getAttribute("src") ?? "");
    const photos = Array.from(container.querySelectorAll("main img")).filter((image) =>
      source(image).includes("/images/landing/")
    );
    expect(photos.length).toBeGreaterThanOrEqual(6);
    for (const image of photos) {
      expect(image.getAttribute("alt")).toBeTruthy();
      expect(image.getAttribute("loading")).toBe("lazy");
    }

    // The hero's first paint is the poster: server-rendered, eager, and
    // decoration (empty alt, inside an aria-hidden layer).
    const eager = Array.from(container.querySelectorAll("main img")).filter(
      (image) => image.getAttribute("loading") !== "lazy"
    );
    expect(eager).toHaveLength(1);
    expect(source(eager[0])).toContain("/videos/landing/hero-poster.webp");
    expect(eager[0].getAttribute("alt")).toBe("");
    expect(eager[0].closest("[aria-hidden]")).not.toBeNull();
  });

  it("starts with the poster alone: no video before the browser has said motion is welcome", () => {
    const { container } = withClient(<LandingPage />);

    // jsdom has no `matchMedia`, which the page reads as « reduce ».
    expect(container.querySelector("video")).toBeNull();
  });

  it("keeps every section in the server's HTML visible: nothing hides before the script says so", () => {
    const { container } = withClient(<LandingPage />);

    expect(container.querySelectorAll("[data-reveal]").length).toBeGreaterThan(10);
    expect(document.documentElement.classList.contains("lp-motion")).toBe(false);
  });
});

describe("the hero badge", () => {
  // Client feedback 2026-11-25: the block moved to the middle, higher, larger.
  it("sits centred above both columns, not inside the headline's", () => {
    withClient(<LandingPage />);

    const badge = screen.getByText("badge");
    const headline = screen.getByRole("heading", { level: 1 });
    expect(badge.parentElement).toHaveClass("justify-center");
    expect(badge.parentElement?.contains(headline)).toBe(false);
    // It comes first in the document, so it is also the first thing read.
    expect(
      badge.compareDocumentPosition(headline) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // Larger than the 0.8rem it was.
    expect(badge.className).toContain("text-[0.95rem]");
    expect(badge.className).toContain("sm:text-[1.1rem]");
  });
});

describe("the search card", () => {
  it("labels each of its four fields", () => {
    withClient(<LandingSearchCard />);

    for (const label of ["from.label", "to.label", "date.label", "title.label"]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByLabelText("date.label")).toHaveAttribute("type", "date");
  });

  it("opens /create with the four values", () => {
    withClient(<LandingSearchCard />);

    fireEvent.change(screen.getByLabelText("from.label"), { target: { value: " Paris " } });
    fireEvent.change(screen.getByLabelText("to.label"), { target: { value: "Lyon" } });
    fireEvent.change(screen.getByLabelText("date.label"), { target: { value: "2026-12-03" } });
    fireEvent.change(screen.getByLabelText("title.label"), { target: { value: "Piano droit" } });
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    expect(push).toHaveBeenCalledWith(
      "/create?title=Piano+droit&from=Paris&to=Lyon&date=2026-12-03"
    );
  });

  it("opens a blank /create when nothing is typed", () => {
    withClient(<LandingSearchCard />);

    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    expect(push).toHaveBeenCalledWith("/create");
  });

  it("is a GET form on /create, so it works before the script loads", () => {
    const { container } = withClient(<LandingSearchCard />);

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("action", "/create");
    expect(form).toHaveAttribute("method", "get");
    expect(
      Array.from(container.querySelectorAll("input")).map((input) => input.getAttribute("name"))
    ).toEqual(["from", "to", "date", "title"]);
  });

  it("fills both towns from an example trajet and moves on to the title", () => {
    withClient(<LandingSearchCard />);
    const [first] = EXAMPLE_ROUTES;

    fireEvent.click(screen.getByRole("button", { name: `exampleFill ${JSON.stringify(first)}` }));

    expect(screen.getByLabelText("from.label")).toHaveValue(first.from);
    expect(screen.getByLabelText("to.label")).toHaveValue(first.to);
    expect(screen.getByLabelText("title.label")).toHaveFocus();
  });

  it("caps what can be typed at what /create keeps", () => {
    withClient(<LandingSearchCard />);

    expect(screen.getByLabelText("title.label")).toHaveAttribute("maxLength", "120");
    expect(screen.getByLabelText("from.label")).toHaveAttribute("maxLength", "80");
  });
});

describe("buildCreateUrl", () => {
  it("keeps the documented order and drops what is empty", () => {
    expect(buildCreateUrl({ date: "2026-12-03", to: "Lyon", title: "  ", from: "" })).toBe(
      "/create?to=Lyon&date=2026-12-03"
    );
  });

  it("encodes what it carries", () => {
    expect(buildCreateUrl({ title: "Table & 4 chaises", from: "Saint-Étienne" })).toBe(
      "/create?title=Table+%26+4+chaises&from=Saint-%C3%89tienne"
    );
  });
});

describe("« Demandes récentes »", () => {
  it("shows a skeleton while it reads", () => {
    list.mockReturnValue(new Promise(() => undefined));
    const { container } = withClient(<LandingRecentRequests />);

    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it("links each card to the request's own page, by its title", async () => {
    list.mockResolvedValue({ items: [ITEM] });
    withClient(<LandingRecentRequests />);

    const link = await screen.findByRole("link", { name: "Canapé 3 places" });
    expect(link).toHaveAttribute("href", "/listing/job-1");
    // A town abroad names its country; a French one does not.
    expect(screen.getByText(/^Bruxelles \(/)).toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
    // Same month: the first day is printed without it (« du 26 au 28 nov. »).
    expect(screen.getByText(/pickupBetween/)).toHaveTextContent('"from":"26"');
  });

  it("shows a town typed in capitals as a name", async () => {
    list.mockResolvedValue({ items: [{ ...ITEM, pickupCity: "MARSEILLE", dropoffCountry: "FR", dropoffCity: "bayonne" }] });
    withClient(<LandingRecentRequests />);

    expect(await screen.findByText("Marseille")).toBeInTheDocument();
    expect(screen.getByText("Bayonne")).toBeInTheDocument();
  });

  it("says when the pickup is a single day", async () => {
    list.mockResolvedValue({
      items: [{ ...ITEM, pickupUntil: "2026-11-26T10:00:00.000Z", isFlexible: false }],
    });
    withClient(<LandingRecentRequests />);

    expect(await screen.findByText(/pickupOn/)).toBeInTheDocument();
  });

  it("leads an empty list to « Publier une demande »", async () => {
    list.mockResolvedValue({ items: [] });
    withClient(<LandingRecentRequests />);

    expect(await screen.findByText("empty.title")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "empty.cta" })).toHaveAttribute("href", "/create");
  });

  it("offers a retry, and the way to post, when the read fails", async () => {
    list.mockRejectedValueOnce(new Error("offline"));
    withClient(<LandingRecentRequests />);

    const retry = await screen.findByRole("button", { name: /retry/ });
    expect(screen.getByRole("link", { name: "empty.cta" })).toHaveAttribute("href", "/create");

    list.mockResolvedValue({ items: [ITEM] });
    fireEvent.click(retry);
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Canapé 3 places" })).toBeInTheDocument()
    );
  });
});
