import { fireEvent, render, screen } from "@testing-library/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { NextIntlClientProvider } from "next-intl";
import { useForm, type UseFormGetValues } from "react-hook-form";
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

/** The rendered form's values, for what a field sends up rather than shows. */
let getValues: UseFormGetValues<JobFormValues>;

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
  getValues = form.getValues;

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

/**
 * Keys typed one at a time at the end of a box, each read back from the box
 * before the next — the way the 15 t bug happened: « 1.0 » came back as « 1 »
 * before the « 5 » arrived.
 */
const typeKeys = (input: HTMLInputElement, keys: string) => {
  for (const key of keys) {
    fireEvent.change(input, { target: { value: input.value + key } });
  }
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
  it("offers the real figure as optional for a bracket that already has a ceiling", () => {
    renderFields();

    choose("weight-upTo30");

    // The required, freight-only field is not this one...
    expect(screen.queryByLabelText(/^Poids exact(?!,)/)).not.toBeInTheDocument();
    // ...but an optional figure that would refine the bracket is offered.
    expect(screen.getByLabelText(/si vous le connaissez/)).toBeInTheDocument();
  });

  it("offers no figure at all for 'I'm not sure'", () => {
    renderFields();

    fireEvent.click(screen.getByRole("radio", { name: /ne sais pas/i }));

    expect(screen.queryByLabelText(/Poids exact/)).not.toBeInTheDocument();
  });

  it("asks for the figure once the load is freight", () => {
    renderFields();

    fireEvent.click(screen.getByRole("radio", { name: /Plus d'1 t/ }));

    expect(screen.getByLabelText(/^Poids exact(?!,)/)).toBeInTheDocument();
  });

  it("takes the figure away again when a lighter bracket is chosen", () => {
    renderFields();

    choose("weight-over1000");
    choose("weight-upTo5");

    // The required freight field is gone...
    expect(screen.queryByLabelText(/^Poids exact(?!,)/)).not.toBeInTheDocument();
    // ...and the optional one for the new bracket starts empty rather than
    // carrying over whatever was typed for the abandoned freight bracket.
    const optional = screen.getByLabelText(
      /si vous le connaissez/
    ) as HTMLInputElement;
    expect(optional.value).toBe("");
  });

  // numeric_input_spec.md §9: the box was re-derived from the kilograms after
  // every keystroke, so « 1.0 » t read « 1 » and 1.05 t was stored as 15 t.
  it("stores 1050 kg for 1.05 t, and keeps « 1,05 » on screen", () => {
    renderFields();
    choose("weight-over1000");
    // Radix answers a letter on a closed select by picking the option it
    // starts — the unit labelled « t ».
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Unité" }), {
      key: "t",
    });

    const figure = screen.getByLabelText(/^Poids exact(?!,)/) as HTMLInputElement;
    typeKeys(figure, "1.05");

    expect(figure.value).toBe("1,05");
    expect(getValues("exactWeightKg")).toBe(1050);
  });

  it("clears a figure typed for a bracket when the next one is picked", () => {
    renderFields();
    choose("weight-upTo30");
    const figure = screen.getByLabelText(/si vous le connaissez/) as HTMLInputElement;
    typeKeys(figure, "12,5");
    expect(getValues("exactWeightKg")).toBe(12.5);

    // Same box, another bracket: what was typed must not ride along.
    choose("weight-upTo100");

    expect(figure.value).toBe("");
    expect(getValues("exactWeightKg")).toBeUndefined();
  });
});

describe("what and how many", () => {
  it.each([
    ["fr", fr, "Que transportez-vous ?", "Quantité"],
    ["en", en, "What are you moving?", "Quantity"],
  ])("asks for the item and its count together in %s", (locale, messages, item, count) => {
    renderFields(locale, messages as typeof en);

    const title = screen.getByLabelText(item, { exact: false });
    const quantity = screen.getByLabelText(count);

    // One row owns both, so the count cannot drift back down the step away
    // from the thing it counts. That they sit on the same visual line is a
    // layout fact jsdom cannot measure; it is checked in Chromium instead.
    expect(title.parentElement?.parentElement).toBe(
      quantity.parentElement?.parentElement
    );
  });

  it("takes neither a minus sign nor part of an item", () => {
    // A text box now, so no `min`: the rule drops « - » and refuses a
    // separator, and the schema answers 0 with `quantityMin`.
    renderFields();
    const quantity = screen.getByLabelText("Quantité") as HTMLInputElement;

    fireEvent.change(quantity, { target: { value: "-3" } });
    expect(quantity.value).toBe("3");

    fireEvent.change(quantity, { target: { value: "3,5" } });
    expect(quantity.value).toBe("3");
    expect(getValues("quantity")).toBe("3");
  });

  // numeric_input_spec.md §6: the count took a floor's three digits, so
  // « 1200 » chairs read « 120 » and were posted as 120 (found in review).
  it("counts past 999, in the one box and in a row", () => {
    renderFields();
    const one = screen.getByLabelText("Quantité") as HTMLInputElement;

    typeKeys(one, "1200");
    expect(one.value).toBe("1200");
    expect(getValues("quantity")).toBe("1200");

    fireEvent.change(screen.getByLabelText("Que transportez-vous ?", { exact: false }), {
      target: { value: "Chaises" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un autre objet/ }));
    const [row] = screen.getAllByLabelText("Quantité") as HTMLInputElement[];
    expect(row.value).toBe("1200");

    // Retyped to another four-digit count: Backspace, then « 5 ».
    fireEvent.change(row, { target: { value: "120" } });
    typeKeys(row, "5");
    expect(row.value).toBe("1205");
    expect(getValues("quantity")).toBe(1205);
  });

  // numeric_input_spec.md §6: each row's count snapped back to « 1 » on
  // every keystroke, so « 2 » typed over « 1 » became « 12 ».
  it("lets a row's quantity be emptied and retyped, and puts 1 back on blur", () => {
    renderFields();
    fireEvent.change(screen.getByLabelText("Que transportez-vous ?", { exact: false }), {
      target: { value: "Canapé" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un autre objet/ }));
    const [first] = screen.getAllByLabelText("Quantité") as HTMLInputElement[];

    fireEvent.change(first, { target: { value: "" } });
    expect(first.value).toBe("");
    // Counted as one while blank: a row mid-retype is not a row of nothing.
    expect(getValues("quantity")).toBe(1);

    typeKeys(first, "2");
    expect(first.value).toBe("2");
    expect(getValues("quantity")).toBe(2);

    fireEvent.change(first, { target: { value: "" } });
    fireEvent.blur(first);
    expect(first.value).toBe("1");
  });

  // numeric_input_spec.md §5.1: the box's tidy reaches the row before the
  // row's own blur. The other way round, the row put « 1 » back and the tidy,
  // worked out from the same rows, overwrote it with « 0 ».
  it("reads « 1 » once a row's « 100 » is left with its « 1 » deleted", () => {
    renderFields();
    fireEvent.change(screen.getByLabelText("Que transportez-vous ?", { exact: false }), {
      target: { value: "Canapé" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ajouter un autre objet/ }));
    const [first] = screen.getAllByLabelText("Quantité") as HTMLInputElement[];

    typeKeys(first, "00");
    expect(first.value).toBe("100");
    // A deletion keeps the zeros it exposes, until the box is left.
    fireEvent.change(first, { target: { value: "00" } });
    expect(first.value).toBe("00");

    fireEvent.blur(first);
    expect(first.value).toBe("1");
    expect(getValues("quantity")).toBe(1);
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

  it("holds a dimension as typed, in the language's own way", () => {
    renderFields();
    fireEvent.click(screen.getByRole("radio", { name: "Dimensions exactes" }));
    const length = screen.getByLabelText("Longueur (cm)") as HTMLInputElement;

    typeKeys(length, "045.5");

    expect(length.value).toBe("45,5");
    expect(getValues("lengthCm")).toBe("45,5");
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
