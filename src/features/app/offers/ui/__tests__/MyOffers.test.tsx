import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import fr from "../../../../../../messages/fr.json";
import { ApiError } from "@/lib/fetcher";

const mine = vi.hoisted(() => vi.fn());
vi.mock("../../api/offers.api", () => ({ offersApi: { mine, withdraw: vi.fn() } }));
vi.mock("@/components/ui/page-loader", () => ({ PageLoader: () => null }));

import { MyOffers } from "../MyOffers";

const M = fr.listing.bid.myOffers;
const show = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NextIntlClientProvider locale="fr" messages={fr}>
        <MyOffers />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );

describe("MyOffers — a failed read", () => {
  it("explains a refusal and leads to the application, with no retry", async () => {
    mine.mockRejectedValue(new ApiError("FORBIDDEN_NOT_CARRIER", "no", 403));
    show();

    expect(await screen.findByText(M.notCarrier)).toBeTruthy();
    expect(screen.getByRole("link", { name: M.application }).getAttribute("href")).toBe("/carrier/application");
    expect(screen.queryByRole("button", { name: fr.common.loadError.retry })).toBeNull();
  });

  it("still offers a retry when the server failed", async () => {
    mine.mockRejectedValue(new ApiError("INTERNAL", "boom", 500));
    show();

    expect(await screen.findByRole("button", { name: fr.common.loadError.retry })).toBeTruthy();
  });
});
