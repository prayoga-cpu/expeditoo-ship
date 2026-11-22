"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  countryCodeFrom,
  countryName,
  countryNameKey,
  countryOptions,
  type CountryOption,
  type JobCountry,
} from "@/lib/countries";
import { cn } from "@/lib/utils";

/**
 * The country of one end of a request: every country and territory of the
 * world (the client, 19 November), which is some 250 names — too many for a
 * plain list, so it is searched. Closed, it reads as the form's other selects
 * do; open, the fourteen frequent countries come first, then all of them by
 * name, and typing narrows to what matches (postal_codes_abroad_spec.md §5).
 *
 * Keyboard: the search box keeps the focus; ↑ ↓ Home End move through what is
 * listed, Enter chooses, Escape closes.
 */

interface CountrySelectProps {
  id: string;
  value: JobCountry;
  onChange: (country: JobCountry) => void;
}

interface Group {
  /** `frequent` / `all`, or null for search results, which have no heading. */
  key: "frequent" | "all" | null;
  options: CountryOption[];
}

/**
 * What a search lists: names containing what was typed, with a country named
 * outright — « USA », « Angleterre », « be » — first, whatever its listed name.
 */
export function matchCountries(all: CountryOption[], query: string): CountryOption[] {
  const key = countryNameKey(query);
  if (!key) return all;
  const exact = countryCodeFrom(query);
  const matches = all.filter(
    (option) => option.code !== exact && countryNameKey(option.name).includes(key)
  );
  const named = all.find((option) => option.code === exact);
  return named ? [named, ...matches] : matches;
}

function useCountryGroups(query: string): Group[] {
  const locale = useLocale();
  const { frequent, all } = useMemo(() => countryOptions(locale), [locale]);
  return useMemo<Group[]>(
    () =>
      countryNameKey(query)
        ? [{ key: null, options: matchCountries(all, query) }]
        : [
            { key: "frequent", options: frequent },
            { key: "all", options: all },
          ],
    [all, frequent, query]
  );
}

const rowKey = (group: Group, option: CountryOption) =>
  `${group.key ?? "found"}-${option.code}`;

/** Where ↑ ↓ Home End take the highlight, or null for any other key. */
function nextIndex(key: string, current: number, count: number): number | null {
  if (count === 0) return null;
  if (key === "ArrowDown") return (current + 1) % count;
  if (key === "ArrowUp") return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

/** The picker's state: what is typed, what is listed, what is highlighted. */
function useCountryPicker(id: string, onChange: (country: JobCountry) => void) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const groups = useCountryGroups(query);
  // One row per listed option, in order: a country is listed twice while
  // nothing is typed (frequent, then all), so a row is not a code.
  const rows = groups.flatMap((group) =>
    group.options.map((option) => ({ key: rowKey(group, option), code: option.code }))
  );

  const toggle = (next: boolean) => {
    setOpen(next);
    setQuery("");
    setActive(0);
  };
  const choose = (code: JobCountry) => {
    onChange(code);
    toggle(false);
  };
  const search = (text: string) => {
    setQuery(text);
    setActive(0);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (rows[active]) choose(rows[active].code);
      return;
    }
    const next = nextIndex(event.key, active, rows.length);
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    document.getElementById(`${id}-${rows[next].key}`)?.scrollIntoView?.({ block: "nearest" });
  };

  return { open, query, groups, activeKey: rows[active]?.key, toggle, choose, search, onKeyDown };
}

export function CountrySelect({ id, value, onChange }: CountrySelectProps) {
  const locale = useLocale();
  const picker = useCountryPicker(id, onChange);
  const { open, query, groups, activeKey } = picker;
  const listId = `${id}-list`;

  return (
    <Popover open={open} onOpenChange={picker.toggle}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          className="border-field-border focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-left text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
        >
          <span className="truncate">{countryName(value, locale)}</span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] min-w-64 p-0"
      >
        <CountrySearch
          listId={listId}
          activeId={activeKey ? `${id}-${activeKey}` : undefined}
          query={query}
          onSearch={picker.search}
          onKeyDown={picker.onKeyDown}
        />
        <CountryList
          id={id}
          groups={groups}
          value={value}
          activeKey={activeKey}
          query={query}
          onChoose={picker.choose}
          onClear={() => picker.search("")}
        />
      </PopoverContent>
    </Popover>
  );
}

/** The search box: it keeps the focus for as long as the list is open. */
function CountrySearch({
  listId,
  activeId,
  query,
  onSearch,
  onKeyDown,
}: {
  listId: string;
  activeId: string | undefined;
  query: string;
  onSearch: (text: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const t = useTranslations("create.where.country");
  return (
    <div className="relative border-b">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        autoFocus
        value={query}
        placeholder={t("search")}
        aria-label={t("search")}
        aria-controls={listId}
        aria-activedescendant={activeId}
        autoComplete="off"
        // 16px on a phone: iOS zooms the page into anything smaller.
        className="h-10 rounded-none border-0 pl-9 text-base shadow-none focus-visible:ring-0 md:text-sm dark:bg-transparent"
        onChange={(event) => onSearch(event.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

function CountryList({
  id,
  groups,
  value,
  activeKey,
  query,
  onChoose,
  onClear,
}: {
  id: string;
  groups: Group[];
  value: JobCountry;
  activeKey: string | undefined;
  query: string;
  onChoose: (code: JobCountry) => void;
  onClear: () => void;
}) {
  const t = useTranslations("create.where.country");
  const isEmpty = groups.every((group) => group.options.length === 0);

  if (isEmpty) {
    // Nothing matches: say so, and give the way back to the whole list.
    return (
      <div id={`${id}-list`} className="space-y-2 px-3 py-4 text-center text-sm">
        <p className="text-muted-foreground">{t("noMatch", { query: query.trim() })}</p>
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          {t("clearSearch")}
        </Button>
      </div>
    );
  }

  return (
    <div id={`${id}-list`} role="listbox" className="max-h-64 overflow-y-auto p-1">
      {groups.map((group) => (
        <div
          key={group.key ?? "found"}
          role="group"
          aria-label={group.key ? t(group.key) : undefined}
        >
          {group.key ? (
            <p className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-medium">
              {t(group.key)}
            </p>
          ) : null}
          {group.options.map((option) => (
            <CountryRow
              key={rowKey(group, option)}
              id={`${id}-${rowKey(group, option)}`}
              option={option}
              isSelected={option.code === value}
              isActive={rowKey(group, option) === activeKey}
              onChoose={onChoose}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function CountryRow({
  id,
  option,
  isSelected,
  isActive,
  onChoose,
}: {
  id: string;
  option: CountryOption;
  isSelected: boolean;
  isActive: boolean;
  onChoose: (code: JobCountry) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="option"
      aria-selected={isSelected}
      // The search box keeps the focus, so the keyboard keeps working.
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onChoose(option.code)}
      className={cn(
        "hover:bg-accent hover:text-accent-foreground flex min-h-9 w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none",
        isActive && "bg-accent text-accent-foreground"
      )}
    >
      <span className="min-w-0 truncate">{option.name}</span>
      {isSelected ? <Check className="size-4 shrink-0" /> : null}
    </button>
  );
}
