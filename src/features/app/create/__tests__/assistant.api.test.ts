import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The box's own deadline (request_assistant_spec.md §4.3): a reading that
 * never answers is given up on, as a refusal the box can say in words —
 * before it, a slow call left « Analyse en cours… » spinning for good.
 */
const post = vi.fn();
vi.mock("@/lib/fetcher", async (original) => ({
  ...(await original<typeof import("@/lib/fetcher")>()),
  api: { get: vi.fn(), post: (...args: unknown[]) => post(...args) },
}));

import { ApiError } from "@/lib/fetcher";
import {
  ASSISTANT_READ_TIMEOUT_MS,
  ASSISTANT_TIMEOUT,
  assistantApi,
} from "../api/assistant.api";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("assistantApi.understand", () => {
  it("answers the reading when it comes in time", async () => {
    post.mockResolvedValue({ title: "Canapé" });

    await expect(assistantApi.understand("un canapé")).resolves.toEqual({ title: "Canapé" });
    expect(post).toHaveBeenCalledWith("/api/listings/assist", { text: "un canapé" });
    // Nothing left ticking once it has answered.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("gives up after thirty seconds, with a code of its own", async () => {
    post.mockReturnValue(new Promise(() => {}));

    const reading = assistantApi.understand("un canapé");
    const refused = expect(reading).rejects.toMatchObject({
      code: ASSISTANT_TIMEOUT,
      status: 408,
    });
    await vi.advanceTimersByTimeAsync(ASSISTANT_READ_TIMEOUT_MS);

    await refused;
    await expect(reading).rejects.toBeInstanceOf(ApiError);
  });

  it("is still waiting just before the deadline", async () => {
    post.mockReturnValue(new Promise(() => {}));
    const settled = vi.fn();

    assistantApi.understand("un canapé").then(settled, settled);
    await vi.advanceTimersByTimeAsync(ASSISTANT_READ_TIMEOUT_MS - 1);

    expect(settled).not.toHaveBeenCalled();
  });

  it("passes the server's own refusal through untouched", async () => {
    post.mockRejectedValue(new ApiError("RATE_LIMITED", "x", 429));

    await expect(assistantApi.understand("un canapé")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    expect(vi.getTimerCount()).toBe(0);
  });
});
