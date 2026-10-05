"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { NUMERIC_RULES } from "@/lib/numeric-input";
import { ITEM_SUGGESTIONS, type ItemSuggestion } from "../cargo";
import type { JobFormApi } from "../hooks/useJobForm";
import { FieldError } from "./FieldError";

interface Row {
  key: string;
  name: string;
  /** As typed — blank while it is being retyped (numeric_input_spec.md §6). */
  quantity: string;
}

let rowKeySeq = 0;
const nextRowKey = () => `item-${++rowKeySeq}`;

/**
 * A row counts as one until it says more. Blank or « 0 » is a row mid-retype,
 * not a row of nothing — and the box itself reads « 1 » again on blur.
 */
const countOf = (row: Row) => Math.max(1, Number(row.quantity) || 0);

/** Longest string `title` accepts (`jobFormSchema`); combined names are cut
 * to fit rather than left to fail with zod's untranslated default message. */
const TITLE_MAX = 120;

/**
 * What is moving and how many of it. A requester with one thing types it on
 * one line, exactly as before — `rows` starts `null` and `title`/`quantity`
 * stay the two registered fields they always were.
 *
 * "+ Add another item" is the escape hatch for more than one thing on the
 * same job. It does not give the API a list: every row, including the first,
 * folds back into that same `title` string and summed `quantity` on every
 * change, the same move already made for a weight bracket and a size preset
 * (docs/specs/cargo_input_spec.md §2) — no other surface learns a new shape.
 */
export function ItemField({ form }: { form: JobFormApi["form"] }) {
  const t = useTranslations("create.what");
  const { register, formState, watch, setValue, getValues } = form;
  const errors = formState.errors;

  const [rows, setRows] = useState<Row[] | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const titleValue = watch("title") ?? "";
  const titleField = register("title");

  const suggestions =
    rows === null && titleValue.trim().length >= 2
      ? ITEM_SUGGESTIONS.filter((s) =>
          t(`itemSuggestions.${s.id}`)
            .toLowerCase()
            .includes(titleValue.trim().toLowerCase())
        ).slice(0, 6)
      : [];

  const applySuggestion = (suggestion: ItemSuggestion) => {
    setValue("title", t(`itemSuggestions.${suggestion.id}`), {
      shouldValidate: true,
    });
    setValue("weightBracket", suggestion.weightBracket, {
      shouldValidate: true,
    });
    if (suggestion.sizePreset) {
      setValue("sizeMode", "preset");
      setValue("sizePreset", suggestion.sizePreset, { shouldValidate: true });
    }
    setSuggestionsOpen(false);
  };

  const combine = (nextRows: Row[]) => {
    const named = nextRows.filter((r) => r.name.trim().length > 0);
    let title =
      named.length <= 1
        ? (named[0]?.name.trim() ?? "")
        : named.map((r) => `${r.name.trim()} (×${countOf(r)})`).join(", ");
    if (title.length > TITLE_MAX) {
      title = `${title.slice(0, TITLE_MAX - 1)}…`;
    }
    const quantity =
      named.length <= 1
        ? (named[0] ? countOf(named[0]) : 1)
        : named.reduce((sum, r) => sum + countOf(r), 0);

    setValue("title", title, { shouldValidate: true });
    setValue("quantity", quantity, { shouldValidate: true });
  };

  // The rows are worked out here and `combine` runs beside `setRows`, not
  // inside an updater: React may run an updater while rendering this
  // component, and `combine`'s `setValue` then re-renders the form's owner
  // mid-render — "Cannot update a component while rendering a different
  // component", which adding an item and retyping a count used to raise.
  const addItem = () => {
    const base = rows ?? [
      {
        key: nextRowKey(),
        name: getValues("title") ?? "",
        quantity: String(Number(getValues("quantity")) || 1),
      },
    ];
    const next = [...base, { key: nextRowKey(), name: "", quantity: "1" }];
    setRows(next);
    combine(next);
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    if (!rows) return;
    const next = rows.map((r) => (r.key === key ? { ...r, ...patch } : r));
    setRows(next);
    combine(next);
  };

  const removeRow = (key: string) => {
    if (!rows) return;
    const next = rows.filter((r) => r.key !== key);
    // Back to the plain single-input shape once only one is left — the
    // registered `title`/`quantity` fields already hold its values.
    setRows(next.length > 1 ? next : null);
    combine(next);
  };

  if (rows === null) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
          <div className="relative min-w-0">
            <Label htmlFor="title" required>
              {t("titleLabel")}
            </Label>
            <Input
              id="title"
              placeholder={t("titlePlaceholder")}
              autoComplete="off"
              {...titleField}
              onFocus={() => setSuggestionsOpen(true)}
              onBlur={(e) => {
                titleField.onBlur(e);
                // A suggestion's onMouseDown fires first and cancels this.
                window.setTimeout(() => setSuggestionsOpen(false), 100);
              }}
            />
            {suggestionsOpen && suggestions.length > 0 && (
              <ul
                role="listbox"
                aria-label={t("itemSuggestionsLabel")}
                className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md"
              >
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="option"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applySuggestion(s)}
                    >
                      {t(`itemSuggestions.${s.id}`)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <FieldError message={errors.title?.message} />
          </div>

          <div>
            <Label htmlFor="quantity">{t("quantity")}</Label>
            <NumericInput
              id="quantity"
              rules={NUMERIC_RULES.QUANTITY}
              {...register("quantity")}
            />
            <FieldError message={errors.quantity?.message} />
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={addItem}
        >
          <Plus className="size-4" />
          {t("addItem")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div
          key={row.key}
          className="grid grid-cols-[minmax(0,1fr)_5.5rem_2rem] items-start gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_2rem]"
        >
          <div className="min-w-0">
            <Label htmlFor={`${row.key}-name`} required={index === 0}>
              {index === 0 ? t("titleLabel") : t("itemLabel", { n: index + 1 })}
            </Label>
            <Input
              id={`${row.key}-name`}
              placeholder={t("titlePlaceholder")}
              value={row.name}
              onChange={(e) => updateRow(row.key, { name: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor={`${row.key}-qty`}>{t("quantity")}</Label>
            {/* May be emptied: snapping back to « 1 » on every keystroke
                turned « 2 », typed over « 1 », into « 12 ». */}
            <NumericInput
              id={`${row.key}-qty`}
              rules={NUMERIC_RULES.QUANTITY}
              value={row.quantity}
              onChange={(e) => updateRow(row.key, { quantity: e.target.value })}
              onBlur={() => {
                if (!(Number(row.quantity) >= 1)) {
                  updateRow(row.key, { quantity: "1" });
                }
              }}
            />
          </div>

          {rows.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mt-6 text-muted-foreground"
              onClick={() => removeRow(row.key)}
              aria-label={t("removeItem")}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ))}

      <FieldError message={errors.title?.message} />
      <FieldError message={errors.quantity?.message} />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={addItem}
      >
        <Plus className="size-4" />
        {t("addItem")}
      </Button>
    </div>
  );
}
