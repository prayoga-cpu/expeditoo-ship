"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import { Input } from "@/components/ui/input";
import {
  decimalSeparatorFor,
  sanitizeNumericInput,
  tidyNumericText,
  type DecimalSeparator,
  type NumericRules,
  type NumericText,
} from "@/lib/numeric-input";

type NumericInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "defaultValue"
> & {
  rules: NumericRules;
  /** The text shown, for a box held in React state; unset under `register()`. */
  value?: string;
};

/** What was selected in a box: `start` equals `end` for a bare caret. */
interface Selected {
  start: number;
  end: number;
  direction: "forward" | "backward" | "none";
}

/** The caller's handlers on what starts an edit, which the box also listens to. */
type EditStarters = Pick<
  NumericInputProps,
  "onKeyDown" | "onKeyUp" | "onPaste" | "onCut" | "onDrop"
>;

/**
 * A text box for a number, cleaned as it is typed by the rule in
 * `lib/numeric-input.ts`: « 040 » reads « 40 », « 40.5 » reads « 40,5 » in
 * French, and a keystroke past the field's limits is refused.
 *
 * It cleans the element itself, puts the caret back, and only then calls
 * `onChange` — so whatever reads the event reads the clean text. That is what
 * lets one box serve both ways a form here holds a field: under
 * `{...register()}` react-hook-form reads the element's value; in React state
 * the state then equals what the box already shows, so React has nothing to
 * rewrite, and a rewrite is what throws the caret to the end.
 *
 * `type="text"`, never `"number"`: a number box hides its text and its caret
 * from the page (numeric_input_spec.md §1).
 */
export function NumericInput({
  rules,
  value,
  onChange,
  onFocus,
  onBlur,
  ...props
}: NumericInputProps) {
  const separator = decimalSeparatorFor(useLocale());
  // What the box held before the edit being handled — a refused edit gets it
  // back. Held in state, that is `value`; under `register()` the element is
  // the only copy, so it is noted on focus and after every edit.
  const before = useRef("");
  const selection = useSelectionAtEdit(props);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = ruleAnswer(event, rules, separator, value ?? before.current);
    writeBack(event.currentTarget, next, selection.take());
    before.current = next.value;
    onChange?.(event);
  };

  return (
    <Input
      inputMode={rules.decimals > 0 ? "decimal" : "numeric"}
      autoComplete="off"
      {...props}
      {...selection.handlers}
      type="text"
      value={value}
      onFocus={(event) => {
        before.current = event.currentTarget.value;
        onFocus?.(event);
      }}
      onChange={handleChange}
      onBlur={(event) => {
        selection.forget();
        tidyOnLeave(event.currentTarget, rules, separator);
        onBlur?.(event);
      }}
    />
  );
}

/**
 * The rule's answer (§3) to the edit an event reports, from `previous`.
 *
 * The browser says what the edit was, and the rule's own test can only read
 * the text: « 0 » typed over the « 20 » of « 2040 » leaves the « 040 » that
 * deleting the « 2 » leaves, and kept its zero (found in review). So an
 * `insert…` type is tidied whatever the text looks like — all but
 * `insertCompositionText`, which an Android keyboard may send for a
 * Backspace inside a composition. That, every `delete…`, an undo and the
 * retype on blur (a plain `Event`) are left to the text.
 */
function ruleAnswer(
  event: React.ChangeEvent<HTMLInputElement>,
  rules: NumericRules,
  separator: DecimalSeparator,
  previous: string
): NumericText {
  const input = event.currentTarget;
  const kind = (event.nativeEvent as InputEvent).inputType ?? "";
  return sanitizeNumericInput(
    input.value,
    input.selectionStart ?? input.value.length,
    rules,
    separator,
    previous,
    kind.startsWith("insert") && kind !== "insertCompositionText"
  );
}

/**
 * Leaving the box tidies the zeros a deletion kept (« 00 » → « 0 »), through
 * the change path, so whoever holds the text hears it before the blur does.
 */
function tidyOnLeave(
  input: HTMLInputElement,
  rules: NumericRules,
  separator: DecimalSeparator
) {
  const tidy = tidyNumericText(input.value, rules, separator);
  if (tidy !== input.value) retype(input, tidy);
}

/**
 * The rule's answer, written into the box with its caret. A refused edit gets
 * back the selection it began from, where one was noted: the rule works the
 * caret out from the lengths, which put it past « , » after Delete there, and
 * a refused paste over the whole text then left nothing selected — the next
 * keystroke was added to the text instead of replacing it.
 */
function writeBack(
  input: HTMLInputElement,
  next: NumericText,
  noted: Selected | null
) {
  if (next.value === input.value) return;
  input.value = next.value;
  const { start, end, direction }: Selected =
    next.refused && noted
      ? noted
      : { start: next.caret, end: next.caret, direction: "none" };
  input.setSelectionRange(start, end, direction);
}

/** What is selected in the box, when it can say. */
function selectionOf(input: HTMLInputElement): Selected | null {
  const { selectionStart: start, selectionEnd: end } = input;
  if (start === null || end === null) return null;
  return { start, end, direction: input.selectionDirection ?? "none" };
}

/**
 * The selection as an edit began. By `onChange` the browser has moved it, so
 * it is noted on whatever starts an edit — a key, a paste, a cut, a drop — and
 * taken, once, by the change that follows. A key that changes nothing, an
 * arrow, is forgotten on its keyup, and anything noted is forgotten when the
 * box is left, so that it cannot stand in for an edit that starts with no
 * key, such as dictation.
 *
 * The handlers go on the box after the caller's props: each stands in for the
 * caller's own and calls it.
 */
function useSelectionAtEdit(own: EditStarters) {
  const noted = useRef<Selected | null>(null);

  const noting =
    <E extends React.SyntheticEvent<HTMLInputElement>>(
      handler?: (event: E) => void
    ) =>
    (event: E) => {
      noted.current = selectionOf(event.currentTarget);
      handler?.(event);
    };

  return {
    handlers: {
      onKeyDown: noting(own.onKeyDown),
      onPaste: noting(own.onPaste),
      onCut: noting(own.onCut),
      onDrop: noting(own.onDrop),
      onKeyUp: (event: React.KeyboardEvent<HTMLInputElement>) => {
        noted.current = null;
        own.onKeyUp?.(event);
      },
    },
    /** The selection noted for the edit being handled, if any — then gone. */
    take() {
      const selected = noted.current;
      noted.current = null;
      return selected;
    },
    /**
     * For when the box is left. A Tab is noted on its keydown here, and its
     * keyup lands on the next field: kept, that note put the selection from
     * before the Tab back on a refused edit made after a click back (found
     * in review).
     */
    forget() {
      noted.current = null;
    },
  };
}

/**
 * Writes `text` into the box the way typing does: past React's own record of
 * the value, then an `input` event — so `onChange` runs, for React state and
 * `register()` alike.
 */
function retype(input: HTMLInputElement, text: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setValue?.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * The text of a box whose number is held somewhere else — kilograms in the
 * request form, cents in a quote patch.
 *
 * The number is never turned back into text while it is typed. That round
 * trip — the text re-derived from the number after every keystroke — made
 * « 1.0 » read « 1 », and saved 1,05 t as 15 t and « 40.05 » as 405 €
 * (numeric_input_spec.md §5.2). The text is rebuilt only when the number
 * changes from outside — a bracket switched, a form refilled — or when the
 * caller asks with `reshow`, as for a change of unit.
 */
export function useNumericText<T>(value: T, toText: (value: T) => string) {
  const [text, setText] = useState(() => toText(value));
  // The number this box last sent up. Anything else arriving came from outside.
  const sent = useRef(value);

  useEffect(() => {
    if (Object.is(value, sent.current)) return;
    sent.current = value;
    setText(toText(value));
    // `toText` is read when the number moves, not watched: a caller's inline
    // formatter is new on every render and would undo every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return {
    text,
    /** What was typed, and the number it reads as — which the caller sends up. */
    typed(next: string, parsed: T) {
      sent.current = parsed;
      setText(next);
    },
    /** The current number shown afresh, written by `format`. */
    reshow(format: (value: T) => string) {
      setText(format(value));
    },
  };
}
