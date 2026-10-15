import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";

/**
 * client_feedback_2026_10_spec.md §7b — « Coordonnées personnelles »: the
 * name in parts, an alias, a phone, and a relative to call.
 */

const session = vi.hoisted(() => ({ refetch: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ useSession: () => session }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ui/page-loader", () => ({
  InlineLoader: () => <div data-testid="inline-loader" />,
}));

import { ContactDetailsCard } from "../ContactDetailsCard";

let stored: Record<string, unknown> | null;
let failRead = false;
const fetchSpy = vi.fn(async (url: string, init?: { method?: string; body?: unknown }) => {
  if (failRead) return new Response(JSON.stringify({ success: false, error: { code: "X", message: "x" } }), { status: 500 });
  if (init?.method === "PUT") {
    const body = JSON.parse(String(init.body));
    stored = { ...stored, ...body, name: `${body.firstName} ${body.lastName}` };
  }
  return new Response(JSON.stringify({ success: true, data: url.includes("/contact") ? stored : null }));
});

beforeEach(() => {
  failRead = false;
  stored = {
    name: "Jean Dupont",
    firstName: null,
    lastName: null,
    alias: null,
    phone: null,
    relativeName: null,
    relativePhone: null,
  };
  fetchSpy.mockClear();
  session.refetch.mockClear();
  vi.stubGlobal("fetch", fetchSpy);
  window.HTMLElement.prototype.hasPointerCapture ??= () => false;
  window.HTMLElement.prototype.scrollIntoView ??= () => {};
});

afterEach(() => vi.unstubAllGlobals());

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
        <ContactDetailsCard />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe("ContactDetailsCard", () => {
  it("reads an older account's name split in two, and says who sees it", async () => {
    renderCard();

    expect(await screen.findByText("Jean Dupont")).toBeInTheDocument();
    expect(screen.getAllByText("Non renseigné").length).toBeGreaterThan(0);
    expect(screen.getByText(/jamais par un transporteur/)).toBeInTheDocument();
  });

  it("saves the parts, the phones and the relative, then refreshes the session", async () => {
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Modifier mes coordonnées" }));

    expect(screen.getByLabelText(/^Prénom\s*\*?$/)).toHaveValue("Jean");
    expect(screen.getByLabelText(/^Nom\s*\*?$/)).toHaveValue("Dupont");
    fireEvent.change(screen.getByLabelText("Pseudo"), { target: { value: "Jeannot" } });
    fireEvent.change(screen.getByLabelText("Nom du proche"), { target: { value: "Marie Dupont" } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/users/me/contact",
        expect.objectContaining({ method: "PUT" })
      )
    );
    const [, init] = fetchSpy.mock.calls.find(([, i]) => i?.method === "PUT")!;
    expect(JSON.parse(String(init!.body))).toEqual({
      firstName: "Jean",
      lastName: "Dupont",
      alias: "Jeannot",
      phone: "",
      relativeName: "Marie Dupont",
      relativePhone: "",
    });
    await waitFor(() =>
      expect(session.refetch).toHaveBeenCalledWith({ query: { disableCookieCache: true } })
    );
    expect(await screen.findByText("Marie Dupont")).toBeInTheDocument();
  });

  it("refuses to save without a last name", async () => {
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Modifier mes coordonnées" }));
    fireEvent.change(screen.getByLabelText(/^Nom\s*\*?$/), { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    expect(await screen.findByText("Le nom est requis")).toBeInTheDocument();
    expect(fetchSpy.mock.calls.some(([, i]) => i?.method === "PUT")).toBe(false);
  });

  it("says when it cannot load, and offers to retry", async () => {
    failRead = true;
    renderCard();

    expect(await screen.findByText("Impossible de charger les coordonnées.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });
});
