import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../../../messages/fr.json";

/** Park / resume a paid quote's auto-publish — §X1, decision 2 of 30 October. */

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AutoPublishControl } from "../AutoPublishControl";

const t = fr.admin.expedion.autoPublish;

function renderIt(escalateAfter: string | null) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
        <AutoPublishControl quoteId="q-1" escalateAfter={escalateAfter} />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("AutoPublishControl", () => {
  it("parks a quote by clearing its publish date — nothing deleted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);
    renderIt("2026-09-20T12:35:40.846Z");

    fireEvent.click(screen.getByRole("button", { name: t.pause }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/expedion/quotes/q-1/admin");
    expect(JSON.parse(init.body)).toEqual({ escalateAfter: null });
  });

  it("resumes a parked quote 48 hours from now", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);
    renderIt(null);
    expect(screen.getByText(t.parkedNote)).toBeInTheDocument();

    const before = Date.now();
    fireEvent.click(screen.getByRole("button", { name: t.resume }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const sent = new Date(JSON.parse(fetchMock.mock.calls[0][1].body).escalateAfter).getTime();
    expect(sent - before).toBeGreaterThanOrEqual(48 * 3_600_000 - 1_000);
    expect(sent - before).toBeLessThanOrEqual(48 * 3_600_000 + 5_000);
  });
});
