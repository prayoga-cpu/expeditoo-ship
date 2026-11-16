import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/fetcher";
import type { RequestDraft } from "@/server/dto/request-assistant.dto";
import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";

/**
 * The box on `/create` (request_assistant_spec.md §4, §7): hidden where it
 * cannot answer, a reading shown before anything is written, a question for
 * what is missing, and a failure that leaves the person somewhere to go.
 */
const availability = vi.fn();
const understand = vi.fn();
vi.mock("../api/assistant.api", () => ({
  assistantApi: {
    availability: () => availability(),
    understand: (text: string) => understand(text),
    transcribe: vi.fn(),
  },
}));

import { RequestAssistant } from "../ui/RequestAssistant";

const onError = vi.fn();
const onApply = vi.fn();

const renderBox = (locale = "fr", messages: typeof fr = fr) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <NextIntlClientProvider locale={locale} messages={messages} onError={onError}>
        <RequestAssistant onApply={onApply} />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );

const draft = (over: Partial<RequestDraft> = {}): RequestDraft => ({
  title: "Canapé 3 places",
  quantity: 2,
  weightBracket: "upTo100",
  exactWeightKg: null,
  sizePreset: "xl",
  dimensions: null,
  pickup: { city: "Lyon", postalCode: "69002", country: "FR" },
  dropoff: { city: "Bruxelles", postalCode: "1000", country: "BE" },
  missing: [],
  outOfArea: [],
  ...over,
});

const t = fr.create.assistant;

const box = () => screen.findByRole("textbox");
const say = async (text: string, button = t.read) => {
  fireEvent.change(await box(), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: button }));
};

beforeEach(() => {
  vi.clearAllMocks();
  availability.mockResolvedValue({ available: true });
});

describe("RequestAssistant", () => {
  it("shows nothing where the assistant cannot answer", async () => {
    availability.mockResolvedValue({ available: false });

    const { container } = renderBox();

    await waitFor(() => expect(availability).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing when the check itself fails — signed out, or offline", async () => {
    availability.mockRejectedValue(new ApiError("UNAUTHORISED", "no", 401));

    const { container } = renderBox();

    await waitFor(() => expect(availability).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("will not read a text too short to be a request", async () => {
    renderBox();

    fireEvent.change(await box(), { target: { value: "ab" } });

    expect(screen.getByRole("button", { name: t.read })).toBeDisabled();
  });

  it("shows the reading before writing anything, then fills on request", async () => {
    understand.mockResolvedValue(draft());
    renderBox();

    await say("deux canapés de Lyon à Bruxelles");

    expect(await screen.findByText("Canapé 3 places × 2")).toBeInTheDocument();
    expect(screen.getByText("XL")).toBeInTheDocument();
    expect(screen.getByText(fr.create.what.weightBrackets.upTo100.label)).toBeInTheDocument();
    expect(screen.getByText("Lyon (69002)")).toBeInTheDocument();
    // A town abroad says where it is.
    expect(screen.getByText("Bruxelles (1000), Belgique")).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: t.fill }));

    expect(onApply).toHaveBeenCalledWith(draft());
    expect(screen.getByText(t.applied)).toBeInTheDocument();
  });

  it("asks for the first thing missing, and reads the answer with what came before", async () => {
    understand
      .mockResolvedValueOnce(draft({ dropoff: null, missing: ["dropoff"] }))
      .mockResolvedValueOnce(draft());
    renderBox();

    await say("un canapé à prendre à Lyon");

    expect(await screen.findByLabelText(t.ask.dropoff)).toBeInTheDocument();
    expect(screen.getByText(t.toSpecify)).toBeInTheDocument();

    await say("à Bruxelles", t.add);

    await waitFor(() =>
      expect(understand).toHaveBeenLastCalledWith("un canapé à prendre à Lyon\nà Bruxelles")
    );
    expect(await screen.findByLabelText(t.askMore)).toBeInTheDocument();
  });

  it("says a country is not served rather than « to be specified »", async () => {
    understand.mockResolvedValue(
      draft({ dropoff: null, missing: ["dropoff"], outOfArea: ["dropoff"] })
    );
    renderBox();

    await say("un piano de Nantes à Londres");

    expect(await screen.findByText(t.outOfArea)).toBeInTheDocument();
  });

  it("offers nothing to fill when nothing was recognised", async () => {
    understand.mockResolvedValue(
      draft({
        title: null,
        quantity: null,
        weightBracket: null,
        sizePreset: null,
        pickup: null,
        dropoff: null,
        missing: ["title", "size", "weight", "pickup", "dropoff"],
      })
    );
    renderBox();

    await say("quel temps fait-il ?");

    expect(await screen.findByText(t.nothing)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.fill })).toBeDisabled();
  });

  it("says what to do when the reading fails, and can be tried again", async () => {
    understand
      .mockRejectedValueOnce(new ApiError("ASSISTANT_FAILED", "x", 502))
      .mockResolvedValueOnce(draft());
    renderBox();

    await say("un canapé de Lyon à Bruxelles");
    expect(await screen.findByRole("alert")).toHaveTextContent(t.error.failed);

    await say("un canapé de Lyon à Bruxelles");
    expect(await screen.findByText("Lyon (69002)")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says to wait when the limit is reached", async () => {
    understand.mockRejectedValue(new ApiError("RATE_LIMITED", "x", 429));
    renderBox();

    await say("un canapé de Lyon à Bruxelles");

    expect(await screen.findByRole("alert")).toHaveTextContent(t.error.rateLimited);
  });

  it("starts again from a blank box", async () => {
    understand.mockResolvedValue(draft());
    renderBox();
    await say("un canapé de Lyon à Bruxelles");
    await screen.findByText("Lyon (69002)");

    fireEvent.click(screen.getByRole("button", { name: t.restart }));

    expect(screen.queryByText("Lyon (69002)")).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.label)).toHaveValue("");
  });

  it.each([
    ["fr", fr],
    ["en", en],
  ] as const)("has every label in %s, including the ones built from an id", async (locale, messages) => {
    understand.mockResolvedValue(
      draft({
        sizePreset: null,
        dimensions: { lengthCm: 210, widthCm: 95, heightCm: 80 },
        exactWeightKg: 24,
        dropoff: null,
        missing: ["dropoff"],
      })
    );
    renderBox(locale, messages as typeof fr);
    fireEvent.change(await box(), { target: { value: "un canapé de Lyon" } });
    fireEvent.click(screen.getByRole("button", { name: messages.create.assistant.read }));

    expect(await screen.findByText("210 × 95 × 80 cm")).toBeInTheDocument();
    expect(screen.getByText("24 kg")).toBeInTheDocument();
    expect(onError).not.toHaveBeenCalled();
  });

  it("asks a question for every field that can be missing, in both languages", () => {
    for (const messages of [fr, en]) {
      expect(Object.keys(messages.create.assistant.ask).sort()).toEqual(
        Object.keys(messages.create.assistant.fields).sort()
      );
    }
  });
});
