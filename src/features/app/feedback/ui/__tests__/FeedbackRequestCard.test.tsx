import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";

/**
 * client_feedback_2026_10_spec.md §6: « J'ai une demande » is a card on the
 * help pages, opening the same feedback dialog the header launcher opens.
 */

vi.mock("../FeedbackDialog", () => ({
  FeedbackDialog: ({ open }: { open: boolean }) =>
    open ? <div role="dialog" aria-label="feedback" /> : null,
}));

import { FeedbackRequestCard } from "../FeedbackRequestCard";

describe("FeedbackRequestCard", () => {
  it("names the request the way the client did, and opens the dialog", () => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
        <FeedbackRequestCard />
      </NextIntlClientProvider>
    );

    expect(screen.getByText("J'ai une demande")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Envoyer une demande" }));
    expect(screen.getByRole("dialog", { name: "feedback" })).toBeInTheDocument();
  });
});
