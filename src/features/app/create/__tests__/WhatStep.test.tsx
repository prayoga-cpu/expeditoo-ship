import { fireEvent, render, screen } from "@testing-library/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { NextIntlClientProvider } from "next-intl";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";
import { SIZE_PRESET_IDS, WEIGHT_BRACKET_IDS } from "../cargo";
import { jobFormSchema, type JobFormValues } from "../schemas";
import { SizeField } from "../ui/SizeField";
import { ItemField } from "../ui/ItemField";
import { WeightBracketField } from "../ui/WeightBracketField";

/**
 * Both labels on every card are looked up at runtime as
 * `create.what.weightBrackets.${id}.label` — built from an id, so neither
 * TypeScript nor a grep can vouch for them, and next-intl renders the key path
 * instead of throwing when one is missing. A bracket added without translations
 * would ship a card reading "create.what.weightBrackets.upTo2000.label" in both
 * languages, so both catalogues are walked here.
 */
const onError = vi.fn();

function Harness({
  locale,
  messages,
}: {
  locale: string;
  messages: typeof en;
}) {
  // Created exactly as `useJobForm` creates it, so the components are handed
  // the type they are declared against without a cast.
  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: { sizeMode: "preset" },
  });

  return (
    <NextIntlClientProvider locale={locale} messages={messages} onError={onError}>
      <ItemField form={form} />
      <WeightBracketField form={form} />
      <SizeField form={form} />
    </NextIntlClientProvider>
  );
}

const renderFields = (locale = "fr", messages = fr) =>
  render(<Harness locale={locale} messages={messages} />);

/**
 * By id rather than by accessible name: several cards legitimately share
 * wording — a suitcase is both a weight and a size — and a test that broke
 * whenever an example was reworded would be testing the copy, not the control.
 */
const choose = (id: string) => {
  const option = document.getElementById(id);
  if (!option) throw new Error(`no option card ${id}`);
  fireEvent.click(option);
};

describe.each([
  ["fr", fr],
  ["en", en],
])("cargo fields in %s", (locale, messages) => {
  it("resolves every bracket and preset label", () => {
    const { container } = renderFields(locale, messages as typeof en);

    expect(container.textContent).not.toContain("create.what");
    expect(onError).not.toHaveBeenCalled();
  });

  it("offers one card per bracket and one per preset", () => {
    renderFields(locale, messages as typeof en);

    // Two mode buttons share the radio role — Radix gives ToggleGroup items
    // `role="radio"` in single mode too.
    const expected =
      WEIGHT_BRACKET_IDS.length + SIZE_PRESET_IDS.length + 2;
    expect(screen.getAllByRole("radio")).toHaveLength(expected);
  });
});

describe("weight", () => {
  it("asks nothing extra for a bracket that has a ceiling", () => {
    renderFields();

    choose("weight-upTo30");

    expect(screen.queryByLabelText(/Poids exact/)).not.toBeInTheDocument();
  });

  it("asks for the figure once the load is freight", () => {
    renderFields();

    fireEvent.click(screen.getByRole("radio", { name: /Plus d'1 t/ }));

    expect(screen.getByLabelText(/Poids exact/)).toBeInTheDocument();
  });

  it("takes the figure away again when a lighter bracket is chosen", () => {
    renderFields();

    choose("weight-over1000");
    choose("weight-upTo5");

    expect(screen.queryByLabelText(/Poids exact/)).not.toBeInTheDocument();
  });
});

describe("what and how many", () => {
  it.each([
    ["fr", fr, "Que transportez-vous ?", "Quantité"],
    ["en", en, "What are you moving?", "Quantity"],
  ])("asks for the item and its count together in %s", (locale, messages, item, count) => {
    renderFields(locale, messages as typeof en);

    const title = screen.getByLabelText(item);
    const quantity = screen.getByLabelText(count);

    // One row owns both, so the count cannot drift back down the step away
    // from the thing it counts. That they sit on the same visual line is a
    // layout fact jsdom cannot measure; it is checked in Chromium instead.
    expect(title.parentElement?.parentElement).toBe(
      quantity.parentElement?.parentElement
    );
  });

  it("will not offer a quantity below one", () => {
    renderFields();

    expect(screen.getByLabelText("Quantité")).toHaveAttribute("min", "1");
  });
});

describe("size", () => {
  it("starts on the standard sizes, with the centimetres each stands for", () => {
    // What the driver will read is on the card, so nothing about the
    // resolution is hidden from the person choosing it.
    const { container } = renderFields();

    expect(container.textContent).toContain("180 × 80 × 120 cm");
    expect(screen.queryByLabelText("Longueur (cm)")).not.toBeInTheDocument();
  });

  it("swaps the cards for three fields when exact dimensions are chosen", () => {
    renderFields();

    fireEvent.click(screen.getByRole("radio", { name: "Dimensions exactes" }));

    expect(screen.getByLabelText("Longueur (cm)")).toBeInTheDocument();
    expect(screen.getByLabelText("Largeur (cm)")).toBeInTheDocument();
    expect(screen.getByLabelText("Hauteur (cm)")).toBeInTheDocument();
    expect(document.getElementById("size-l")).toBeNull();
  });

  it("keeps a mode selected when its button is pressed a second time", () => {
    // Radix clears a single-select ToggleGroup on re-press. A size mode has to
    // be one or the other, so the field refuses to fall back to nothing.
    renderFields();

    const exact = screen.getByRole("radio", { name: "Dimensions exactes" });
    fireEvent.click(exact);
    fireEvent.click(exact);

    expect(screen.getByLabelText("Longueur (cm)")).toBeInTheDocument();
  });
});
