"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronDown } from "lucide-react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const DEFAULT_COUNTRY: CountryCode = "FR";

/** Regional-indicator flag from an ISO 3166-1 alpha-2 code — no image asset needed. */
function flagEmoji(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

interface PhoneInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  "aria-invalid"?: boolean;
}

/**
 * A phone number field that formats as the person types — `AsYouType` inserts
 * the spacing a national number normally has, so nobody has to type it
 * themselves — and stores E.164 (`+33612345678`) once the digits form a
 * complete number, which is what `isValidPhoneNumber` and the rest of the
 * stack expect. The country dropdown is a flag and dial code; picking one
 * re-formats whatever digits are already typed rather than clearing them.
 */
export function PhoneInput({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  className,
  ...rest
}: PhoneInputProps) {
  const locale = useLocale();
  const t = useTranslations("common.phoneInput");
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const lastEmitted = useRef("");

  // Only re-derive from the `value` prop when it changed for a reason other
  // than this component's own last `onChange` — a draft restore or a form
  // reset, not every keystroke echoing back through react-hook-form.
  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    if (!value) {
      setText("");
      return;
    }
    const parsed = parsePhoneNumberFromString(value);
    if (parsed) {
      setCountry(parsed.country ?? DEFAULT_COUNTRY);
      setText(parsed.formatNational());
    } else {
      setText(value);
    }
  }, [value]);

  const regionNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: "region" }),
    [locale]
  );

  const countries = useMemo(() => {
    const others = getCountries()
      .filter((code) => code !== DEFAULT_COUNTRY)
      .map((code) => ({
        code,
        name: regionNames.of(code) ?? code,
        callingCode: getCountryCallingCode(code),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, locale));

    return [
      {
        code: DEFAULT_COUNTRY,
        name: regionNames.of(DEFAULT_COUNTRY) ?? DEFAULT_COUNTRY,
        callingCode: getCountryCallingCode(DEFAULT_COUNTRY),
      },
      ...others,
    ];
  }, [regionNames, locale]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    const digits = q.replace(/^\+/, "");
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.callingCode.startsWith(digits)
    );
  }, [countries, query]);

  const emit = (nextCountry: CountryCode, raw: string) => {
    const formatter = new AsYouType(nextCountry);
    const formatted = formatter.input(raw);
    setText(formatted);
    const number = formatter.getNumber();
    const next = number ? number.number : "";
    lastEmitted.current = next;
    onChange(next);
  };

  return (
    <div className={cn("flex gap-1.5", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-9 shrink-0 gap-1 px-2.5 font-normal"
          >
            <span className="text-base leading-none">{flagEmoji(country)}</span>
            <span className="text-muted-foreground text-sm">
              +{getCountryCallingCode(country)}
            </span>
            <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="border-b p-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-8 text-sm"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="text-muted-foreground px-2 py-3 text-center text-sm">
                {t("noResults")}
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  className="hover:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
                  onClick={() => {
                    const digits = text.replace(/\D/g, "");
                    setCountry(c.code);
                    setQuery("");
                    setOpen(false);
                    emit(c.code, digits);
                  }}
                >
                  <span className="text-base leading-none">{flagEmoji(c.code)}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-muted-foreground">+{c.callingCode}</span>
                  {c.code === country && <Check className="text-primary h-4 w-4" />}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={text}
        placeholder={placeholder}
        onChange={(e) => emit(country, e.target.value)}
        onBlur={onBlur}
        className="flex-1"
        {...rest}
      />
    </div>
  );
}
