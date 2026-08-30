import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi, beforeEach } from "vitest";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";
import { ConfirmMilestone } from "../ui/ConfirmMilestone";
import type { ConfirmationSubject } from "../api/confirm.api";
import {
  useConfirmationSubject,
  useSubmitConfirmation,
} from "../hooks/useConfirmation";

/**
 * Covers docs/specs/transport_status_confirmation_spec.md §10.
 *
 * This page is opened from an SMS by someone with no account and no other way
 * to find out what happened, so every branch has to render something that says
 * what is going on. A silent failure here is a dead end for the reader.
 *
 * Both catalogues are walked because the copy is looked up by milestone
 * (`title.${milestone}`) — built from a value, so neither TypeScript nor a grep
 * can vouch for it, and next-intl renders the key path rather than throwing
 * when one is missing.
 */

vi.mock("../hooks/useConfirmation", () => ({
  useConfirmationSubject: vi.fn(),
  useSubmitConfirmation: vi.fn(),
}));

vi.mock("@/components/ui/page-loader", () => ({
  PageLoader: () => <div data-testid="loader" />,
}));

const onError = vi.fn();

const SUBJECT: ConfirmationSubject = {
  milestone: "DELIVERED",
  shipmentStatus: "DELIVERED",
  pickupCity: "Paris",
  dropoffCity: "Marseille",
  reference: "BX-77",
  alreadyConfirmed: false,
  confirmedAt: null,
  confirmable: true,
  cancelled: false,
};

function mockHooks(
  subject: Partial<typeof SUBJECT> | null,
  over: Record<string, unknown> = {},
  submit: Record<string, unknown> = {}
) {
  vi.mocked(useConfirmationSubject).mockReturnValue({
    subject: subject ? { ...SUBJECT, ...subject } : null,
    isLoading: false,
    isError: false,
    isInvalidToken: false,
    ...over,
  } as never);
  vi.mocked(useSubmitConfirmation).mockReturnValue({
    submit: vi.fn(),
    isPending: false,
    isDone: false,
    isError: false,
    ...submit,
  } as never);
}

/**
 * Only the `confirm` namespace, which is the only one this component reads.
 * Handing the provider both 1900-key catalogues made the first render in the
 * file take 15s on a loaded machine and time out, while every later one took
 * 200ms — the cost was provider setup, not anything under test.
 */
const CATALOGUE = { fr: { confirm: fr.confirm }, en: { confirm: en.confirm } };

function renderPage(locale: "fr" | "en" = "fr") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={CATALOGUE[locale]}
      onError={onError}
    >
      <ConfirmMilestone token="tok_1" />
    </NextIntlClientProvider>
  );
}

/**
 * The first render in a jsdom file pays a one-off environment cost that
 * exceeds vitest's 5s default when the suite runs several files at once — the
 * assertions themselves take ~30ms. Stated once here rather than left as an
 * intermittent failure that only shows up on full-suite runs.
 */
const FIRST_RENDER_TIMEOUT = 30_000;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ConfirmMilestone", () => {
  it.each(["fr", "en"] as const)(
    "offers the confirmation with no missing copy in %s",
    (locale) => {
      mockHooks({});
      renderPage(locale);

      expect(screen.getByText("Marseille")).toBeInTheDocument();
      expect(screen.getByText("BX-77")).toBeInTheDocument();
      expect(screen.getByRole("button")).toBeEnabled();
      // next-intl renders the key path instead of throwing on a missing key.
      expect(onError).not.toHaveBeenCalled();
    },
    FIRST_RENDER_TIMEOUT
  );

  it.each(["PICKED_UP", "DELIVERED"] as const)(
    "has copy for the %s milestone in both catalogues",
    (milestone) => {
      for (const locale of ["fr", "en"] as const) {
        mockHooks({ milestone, confirmable: true });
        const { unmount } = renderPage(locale);
        expect(onError).not.toHaveBeenCalled();
        unmount();
      }
    },
    FIRST_RENDER_TIMEOUT
  );

  it("still renders the confirmation when the route is unknown", () => {
    // `describeToken` returns null cities rather than falling back to the
    // street addresses, so the card has to cope with having no route to show.
    mockHooks({ pickupCity: null, dropoffCity: null });
    renderPage();

    expect(screen.getByRole("button")).toBeEnabled();
    expect(screen.getByText("BX-77")).toBeInTheDocument();
  }, FIRST_RENDER_TIMEOUT);

  it("submits when the button is pressed", () => {
    const submit = vi.fn();
    mockHooks({}, {}, { submit });
    renderPage();

    fireEvent.click(screen.getByRole("button"));
    expect(submit).toHaveBeenCalledOnce();
  }, FIRST_RENDER_TIMEOUT);

  it("shows a thank-you rather than the button once submitted", () => {
    mockHooks({}, {}, { isDone: true });
    renderPage();

    expect(screen.getByText(fr.confirm.done.title)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  }, FIRST_RENDER_TIMEOUT);

  it("treats an already-answered milestone as done, not as an error", () => {
    mockHooks({ alreadyConfirmed: true });
    renderPage();

    expect(screen.getByText(fr.confirm.already.title)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  }, FIRST_RENDER_TIMEOUT);

  it("says the step has not happened yet rather than offering a doomed button", () => {
    // The service would answer MILESTONE_NOT_REACHED, so the button would only
    // ever produce an error the reader cannot act on.
    mockHooks({ confirmable: false });
    renderPage();

    expect(screen.getByText(fr.confirm.notYet.title)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  }, FIRST_RENDER_TIMEOUT);

  it("explains a dead link instead of rendering a blank page", () => {
    mockHooks(null, { isError: true, isInvalidToken: true });
    renderPage();

    expect(screen.getByText(fr.confirm.invalid.title)).toBeInTheDocument();
  }, FIRST_RENDER_TIMEOUT);

  it("says the load failed, not that the save failed", () => {
    // The branch used to print the save-failure sentence twice, for a GET that
    // never got as far as saving anything.
    mockHooks(null, { isError: true, isInvalidToken: false });
    renderPage();

    expect(
      screen.getByText(fr.confirm.unavailable.title)
    ).toBeInTheDocument();
    expect(screen.getByText(fr.confirm.unavailable.body)).toBeInTheDocument();
    expect(screen.queryByText(fr.confirm.error)).not.toBeInTheDocument();
  }, FIRST_RENDER_TIMEOUT);

  it("tells a client on a cancelled run there is nothing coming", () => {
    // Not the "not yet" copy, which promises a further message that a
    // cancelled transport will never send.
    mockHooks({ confirmable: false, cancelled: true });
    renderPage();

    expect(screen.getByText(fr.confirm.cancelled.title)).toBeInTheDocument();
    expect(screen.queryByText(fr.confirm.notYet.title)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  }, FIRST_RENDER_TIMEOUT);

  it("thanks a first-time confirmer instead of saying they already had", () => {
    // The successful mutation invalidates the describe query, so the refetch
    // lands with alreadyConfirmed=true — reading that first flipped the
    // thank-you to "déjà confirmé" moments after the client tapped confirm.
    mockHooks({ alreadyConfirmed: true }, {}, { isDone: true });
    renderPage();

    expect(screen.getByText(fr.confirm.done.title)).toBeInTheDocument();
    expect(screen.queryByText(fr.confirm.already.title)).not.toBeInTheDocument();
  }, FIRST_RENDER_TIMEOUT);

  it("shows the loader while the subject is in flight", () => {
    mockHooks(null, { isLoading: true });
    renderPage();

    expect(screen.getByTestId("loader")).toBeInTheDocument();
  }, FIRST_RENDER_TIMEOUT);
});
