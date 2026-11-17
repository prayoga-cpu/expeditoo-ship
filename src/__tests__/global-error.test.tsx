import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import GlobalError from "../app/global-error";

/**
 * The last-resort boundary has no i18n provider (whatever broke the root layout
 * may have broken it), so it picks its language from the browser itself.
 */
describe("GlobalError", () => {
  afterEach(() => vi.restoreAllMocks());

  const renderWith = (language: string) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(window.navigator, "language", "get").mockReturnValue(language);
    return render(<GlobalError error={new Error("boom")} reset={vi.fn()} />);
  };

  it("speaks French to a French browser", () => {
    renderWith("fr-FR");
    expect(screen.getByText("Une erreur est survenue.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
  });

  it("speaks English to an English browser", () => {
    renderWith("en-GB");
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("falls back to French, the product's primary language, for any other browser", () => {
    renderWith("de-DE");
    expect(screen.getByText("Une erreur est survenue.")).toBeInTheDocument();
  });
});
