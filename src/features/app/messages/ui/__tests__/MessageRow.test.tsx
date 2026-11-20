import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import fr from "../../../../../../messages/fr.json";
import type { Message } from "../../types";
import { MessageRow } from "../MessageRow";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const base: Message = {
  id: "c1",
  name: "Nicolas Martin",
  initials: "NM",
  listing: "Canapé",
  snippet: "Bonjour, je passe demain",
  timestamp: "Hier",
  unread: false,
  route: "Paris → Lyon",
  dates: "20 nov. – 22 nov.",
};

const renderRow = (message: Partial<Message> = {}) =>
  render(
    <NextIntlClientProvider locale="fr" messages={fr}>
      <MessageRow message={{ ...base, ...message }} />
    </NextIntlClientProvider>
  );

/** client feedback 2026-11-19, #32 */
describe("MessageRow", () => {
  it("shows two-letter initials and keeps the full name line", () => {
    renderRow();

    expect(screen.getByText("NM")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nicolas Martin" })).toBeInTheDocument();
  });

  it("derives initials from the name when none were given", () => {
    renderRow({ initials: undefined, name: "Ana Silva" });

    expect(screen.getByText("AS")).toBeInTheDocument();
  });

  it("puts the date on the name line and the last message on the job line", () => {
    renderRow();

    const name = screen.getByRole("heading", { name: "Nicolas Martin" });
    expect(name.parentElement?.parentElement).toHaveTextContent("Hier");
    expect(screen.getByTestId("row-snippet").parentElement).toHaveTextContent("Canapé");
    expect(screen.getByText("Paris → Lyon · 20 nov. – 22 nov.")).toBeInTheDocument();
  });

  it("is three lines at most with a job, and styles an unread snippet", () => {
    renderRow({ unread: true });

    expect(screen.getByTestId("row-snippet")).toHaveClass("font-semibold");
    const content = screen.getByRole("heading", { name: "Nicolas Martin" }).closest("div.flex-1");
    expect(content?.children).toHaveLength(3);
  });
});
