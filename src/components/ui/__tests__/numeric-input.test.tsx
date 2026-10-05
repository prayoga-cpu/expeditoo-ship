import { useState, type ReactNode } from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useForm, type UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { NUMERIC_RULES, centsToInput } from "@/lib/numeric-input";
import { NumericInput, useNumericText } from "../numeric-input";

/**
 * The box (numeric_input_spec.md §5): it must clean the element *before* the
 * caller's `onChange` reads it, because that is the only way one component
 * serves both `register()` and React state. jsdom moves no caret the way a
 * keyboard does, so the rule's carets are asserted on the pure rule
 * (`src/lib/__tests__/numeric-input.test.ts`) and checked in Chromium; the
 * selection a refused edit gets back is asserted here, with the caret each
 * edit leaves placed by hand where a browser leaves it (`browserEdit`).
 */

const intl = (locale: string) =>
  function Intl({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale={locale} messages={{}}>
        {children}
      </NextIntlClientProvider>
    );
  };

const box = () => screen.getByRole("textbox", { name: "amount" }) as HTMLInputElement;

const setValue = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  "value"
)?.set;

/**
 * An edit as a browser makes it: the text changed past React's record of it,
 * the caret where the browser leaves it, then `input` — carrying the
 * `inputType` a browser gives it, when one is named. jsdom moves no caret of
 * its own, so it is placed by hand.
 */
function browserEdit(
  input: HTMLInputElement,
  text: string,
  caret: number,
  inputType?: string
) {
  setValue?.call(input, text);
  input.setSelectionRange(caret, caret);
  fireEvent.input(input, { inputType });
}

const selected = (input: HTMLInputElement) => [
  input.selectionStart,
  input.selectionEnd,
  input.selectionDirection,
];

describe("NumericInput under register()", () => {
  let form: UseFormReturn<{ budget: string }>;

  function Registered() {
    form = useForm<{ budget: string }>({ defaultValues: { budget: "" } });
    return (
      <NumericInput
        aria-label="amount"
        rules={NUMERIC_RULES.MONEY}
        {...form.register("budget")}
      />
    );
  }

  it("leaves « 40 » for « 040 », in the box and in the form", () => {
    render(<Registered />, { wrapper: intl("fr") });

    fireEvent.change(box(), { target: { value: "040" } });

    expect(box().value).toBe("40");
    expect(form.getValues("budget")).toBe("40");
  });

  it("keeps what it had when an edit breaks a limit", () => {
    render(<Registered />, { wrapper: intl("fr") });

    fireEvent.change(box(), { target: { value: "123456" } });
    fireEvent.change(box(), { target: { value: "1234567" } });

    expect(box().value).toBe("123456");
    expect(form.getValues("budget")).toBe("123456");
  });

  it("tidies on blur what a deletion kept, in the box and in the form", () => {
    render(<Registered />, { wrapper: intl("fr") });

    fireEvent.change(box(), { target: { value: "200" } });
    fireEvent.change(box(), { target: { value: "00" } });
    expect(box().value).toBe("00");

    fireEvent.blur(box());

    expect(box().value).toBe("0");
    expect(form.getValues("budget")).toBe("0");
  });

  // Found in review: from the text alone, « 0 » typed over the « 20 » of
  // « 2040 » is the « 2 » deleted, and the box and the form held « 040 ».
  it("tidies a digit typed over a selection, in the box and in the form", () => {
    render(<Registered />, { wrapper: intl("fr") });
    fireEvent.change(box(), { target: { value: "2040" } });

    box().setSelectionRange(0, 2);
    fireEvent.keyDown(box(), { key: "0" });
    browserEdit(box(), "040", 1, "insertText");

    expect(box().value).toBe("40");
    expect(form.getValues("budget")).toBe("40");
  });

  // Found in review: the caret went to the end, so with nothing selected the
  // next paste was added to the text instead of replacing it.
  it("keeps the whole text selected when a paste over it is refused", () => {
    render(<Registered />, { wrapper: intl("fr") });
    fireEvent.change(box(), { target: { value: "1200,50" } });

    box().setSelectionRange(0, 7, "backward");
    fireEvent.paste(box());
    browserEdit(box(), "1.200,50 €", 10);

    expect(box().value).toBe("1200,50");
    expect(form.getValues("budget")).toBe("1200,50");
    expect(selected(box())).toEqual([0, 7, "backward"]);
  });

  it("is a text box that brings up a decimal keypad", () => {
    render(<Registered />, { wrapper: intl("fr") });

    expect(box()).toHaveAttribute("type", "text");
    expect(box()).toHaveAttribute("inputmode", "decimal");
    expect(box()).toHaveAttribute("autocomplete", "off");
  });
});

describe("NumericInput in React state", () => {
  const onChange = vi.fn<(text: string) => void>();

  function Held({ initial = "" }: { initial?: string }) {
    const [text, setText] = useState(initial);
    return (
      <NumericInput
        aria-label="amount"
        rules={NUMERIC_RULES.MONEY}
        value={text}
        onChange={(e) => {
          onChange(e.target.value);
          setText(e.target.value);
        }}
      />
    );
  }

  it("hands the caller the clean text, in the language's own way", () => {
    render(<Held />, { wrapper: intl("fr") });

    fireEvent.change(box(), { target: { value: "40.5" } });

    expect(onChange).toHaveBeenLastCalledWith("40,5");
    expect(box().value).toBe("40,5");
  });

  it("writes English with a point", () => {
    render(<Held />, { wrapper: intl("en") });

    fireEvent.change(box(), { target: { value: "40,5" } });

    expect(box().value).toBe("40.5");
  });

  it("hands back the previous text for a refused edit", () => {
    render(<Held initial="12,34" />, { wrapper: intl("fr") });

    fireEvent.change(box(), { target: { value: "12,345" } });

    expect(onChange).toHaveBeenLastCalledWith("12,34");
    expect(box().value).toBe("12,34");
  });

  it("gives « 100 » when the « 2 » of « 200 » is replaced by a « 1 »", () => {
    render(<Held initial="200" />, { wrapper: intl("fr") });

    fireEvent.change(box(), { target: { value: "00" } });
    fireEvent.change(box(), { target: { value: "100" } });

    expect(onChange).toHaveBeenLastCalledWith("100");
    expect(box().value).toBe("100");
  });

  // The order is the contract (§5.1): an item row's own blur puts « 1 » back,
  // and a tidy heard after it overwrote that « 1 » with « 0 » (§6).
  it("hands the caller the tidied text when the box is left, then its own onBlur", () => {
    const heard: string[] = [];
    function HeldWithBlur() {
      const [text, setText] = useState("040");
      return (
        <NumericInput
          aria-label="amount"
          rules={NUMERIC_RULES.MONEY}
          value={text}
          onChange={(e) => {
            heard.push(`change ${e.target.value}`);
            setText(e.target.value);
          }}
          onBlur={(e) => {
            heard.push(`blur ${e.currentTarget.value}`);
          }}
        />
      );
    }
    render(<HeldWithBlur />, { wrapper: intl("fr") });

    fireEvent.blur(box());

    expect(heard).toEqual(["change 40", "blur 40"]);
    expect(box().value).toBe("40");
  });

  // Found in review: the rule read the text alone, and « 040 » left by a
  // digit typed over « 20 » is also « 2040 » with its « 2 » deleted.
  it.each([
    ["typed", "insertText", "2040", 0, 2, "0", "40"],
    ["pasted", "insertFromPaste", "1040", 0, 4, "040", "40"],
    ["deleted", "deleteContentBackward", "200", 0, 1, "", "00"],
    ["cut", "deleteByCut", "1005", 0, 1, "", "005"],
    // Left to the text: an Android keyboard may send this for a Backspace.
    ["composed", "insertCompositionText", "2040", 0, 2, "0", "040"],
  ])(
    "reads what was %s the way the browser says (%s)",
    (_how, inputType, initial, from, to, typed, after) => {
      render(<Held initial={initial} />, { wrapper: intl("fr") });

      box().setSelectionRange(from, to);
      const text = initial.slice(0, from) + typed + initial.slice(to);
      browserEdit(box(), text, from + typed.length, inputType);

      expect(box().value).toBe(after);
      expect(onChange).toHaveBeenLastCalledWith(after);
    }
  );

  // Found in review: worked out from the lengths, the caret jumped over the
  // « , » after Delete — in the tonnes box, after almost every one.
  it.each([
    ["Delete", "before", 6],
    ["Backspace", "after", 7],
  ])("puts the caret back where it was when %s %s the « , » is refused", (key, _side, at) => {
    render(<Held initial="123456,78" />, { wrapper: intl("fr") });

    box().setSelectionRange(at, at);
    fireEvent.keyDown(box(), { key });
    // Either way the browser leaves « 12345678 » with its caret at 6.
    browserEdit(box(), "12345678", 6);

    expect(box().value).toBe("123456,78");
    expect(selected(box())).toEqual([at, at, "none"]);
  });

  it("works the caret out from the lengths when nothing was noted", () => {
    render(<Held initial="123456,78" />, { wrapper: intl("fr") });

    // An arrow key notes the caret, edits nothing, and is forgotten on keyup;
    // the edit that follows starts with no key, as dictation does.
    box().setSelectionRange(0, 0);
    fireEvent.keyDown(box(), { key: "ArrowLeft" });
    fireEvent.keyUp(box(), { key: "ArrowLeft" });
    browserEdit(box(), "12345678", 6);

    expect(selected(box())).toEqual([7, 7, "none"]);
  });

  it("uses a noted selection for one edit only", () => {
    render(<Held initial="12,5" />, { wrapper: intl("fr") });

    box().setSelectionRange(4, 4);
    fireEvent.keyDown(box(), { key: "5" });
    browserEdit(box(), "12,55", 5);
    expect(box().value).toBe("12,55");

    // Refused, with no key of its own: the « 5 »'s caret is not reused.
    browserEdit(box(), "12,555", 6);
    expect(box().value).toBe("12,55");
    expect(selected(box())).toEqual([5, 5, "none"]);
  });

  // Found in review: a Tab is noted on its keydown here and its keyup lands
  // on the next field, so the note outlived the focus. Back by a click, an
  // edit with no key of its own — dictation — got the Tab's selection back.
  it.each([
    ["the caret", 6, 6, "none", 0, "7123456", 1, [0, 0, "none"]],
    ["the selection", 0, 6, "forward", 2, "1273456", 3, [2, 2, "none"]],
  ] as const)(
    "forgets %s noted before a Tab out, once the box is clicked back into",
    (_what, start, end, direction, clickAt, edited, caret, after) => {
      render(
        <>
          <Held initial="123456" />
          <input aria-label="next" />
        </>,
        { wrapper: intl("fr") }
      );
      const next = screen.getByRole("textbox", { name: "next" });

      act(() => box().focus());
      box().setSelectionRange(start, end, direction);
      fireEvent.keyDown(box(), { key: "Tab" });
      act(() => next.focus());
      fireEvent.keyUp(next, { key: "Tab" });
      act(() => box().focus());
      box().setSelectionRange(clickAt, clickAt);
      browserEdit(box(), edited, caret);

      expect(box().value).toBe("123456");
      expect(selected(box())).toEqual(after);
    }
  );

  it("still hands the caller's own handlers their events", () => {
    const onKeyDown = vi.fn();
    const onPaste = vi.fn();
    render(
      <NumericInput
        aria-label="amount"
        rules={NUMERIC_RULES.MONEY}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />,
      { wrapper: intl("fr") }
    );

    fireEvent.keyDown(box(), { key: "4" });
    fireEvent.paste(box());

    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onPaste).toHaveBeenCalledTimes(1);
  });

  it("brings up a number keypad for a count", () => {
    render(
      <NumericInput aria-label="amount" rules={NUMERIC_RULES.COUNT} />,
      { wrapper: intl("fr") }
    );

    expect(box()).toHaveAttribute("inputmode", "numeric");
  });
});

describe("useNumericText", () => {
  const toText = (cents: number | null) =>
    cents === null ? "" : centsToInput(cents, "fr");

  const setup = () =>
    renderHook(({ value }) => useNumericText(value, toText), {
      initialProps: { value: null as number | null },
    });

  it("keeps « 40,0 » while the cents it reads as come back — the 405 € bug", () => {
    const { result, rerender } = setup();

    act(() => result.current.typed("40,0", 4000));
    rerender({ value: 4000 });
    expect(result.current.text).toBe("40,0");

    act(() => result.current.typed("40,05", 4005));
    rerender({ value: 4005 });
    expect(result.current.text).toBe("40,05");
  });

  it("rebuilds the text when the number changes from outside", () => {
    const { result, rerender } = setup();
    act(() => result.current.typed("40,0", 4000));
    rerender({ value: 4000 });

    // « Analyser avec l'IA » refilled the form.
    rerender({ value: 8990 });
    expect(result.current.text).toBe("89,90");

    rerender({ value: null });
    expect(result.current.text).toBe("");
  });

  it("shows the number afresh when asked, as for a change of unit", () => {
    const { result, rerender } = setup();
    rerender({ value: 1050 });

    act(() => result.current.reshow((cents) => `${cents} c`));

    expect(result.current.text).toBe("1050 c");
  });
});
