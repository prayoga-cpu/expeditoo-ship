"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { searchAddress } from "@/lib/geocoding";

/** A place chosen from the suggestions — a name and the coordinates behind it. */
export interface CityValue {
  label: string;
  lat: number;
  lng: number;
}

interface CityFieldProps {
  id: string;
  value: CityValue | null;
  /**
   * `null` means the field no longer names a resolved place — because the
   * driver edited it or cleared it. It does **not** mean "remove this field".
   */
  onChange: (value: CityValue | null) => void;
  placeholder: string;
  /** Rendered inside the field, before the text. */
  icon?: React.ReactNode;
  className?: string;
}

/**
 * One city, typed and picked.
 *
 * `LocationPickerField` answers the same question with a map and a draggable
 * pin, which is right when the answer is a doorstep the courier has to find. A
 * search bar wants the opposite: a name, coordinates behind it, and no map.
 *
 * **Typing alone filters nothing.** Only a chosen suggestion carries
 * coordinates, so a half-typed city narrows the board by accident.
 */
export function CityField({
  id,
  value,
  onChange,
  placeholder,
  icon,
  className,
}: CityFieldProps) {
  const t = useTranslations("common.cityField");

  const [text, setText] = useState(value?.label ?? "");
  const [results, setResults] = useState<CityValue[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * While the driver is typing, the text belongs to them; otherwise it belongs
   * to the value the parent holds.
   *
   * Editing a chosen city drops its coordinates, which lands back here as a
   * `null` value — following that blindly wiped the characters being typed. A
   * "was this my own edit" flag looks simpler but strands: a parent that maps
   * `null` back to the same placeholder object leaves the value identity
   * unchanged, the effect never runs, and the flag stays set until it swallows
   * a real external change. Focus cannot strand, and resyncs on blur either
   * way.
   */
  useEffect(() => {
    if (isFocused) return;
    setText(value?.label ?? "");
  }, [value, isFocused]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const handleChange = useCallback(
    (query: string) => {
      setText(query);
      // Editing a chosen city drops the stale coordinates rather than keeping
      // them under a new name. `null` means "no longer resolved" — never
      // "remove me": what that should do is the parent's business, and a
      // waypoint row that deleted itself on the first keystroke could never be
      // filled in at all.
      if (value) onChange(null);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (query.trim().length < 3) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      timeoutRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const found = await searchAddress(query, "fr", 5);
          setResults(
            found.map((result) => ({
              label: result.place_name,
              lat: result.center[1],
              lng: result.center[0],
            }))
          );
          setIsOpen(true);
        } catch {
          setResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [onChange, value]
  );

  const clear = () => {
    setText("");
    setResults([]);
    setIsOpen(false);
    onChange(null);
  };

  return (
    <div className={cn("relative", className)}>
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2">
        {icon ?? <MapPin className="h-4 w-4" />}
      </span>

      <Input
        id={id}
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className="pr-9 pl-9"
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => {
          setIsFocused(true);
          if (results.length > 0) setIsOpen(true);
        }}
        onBlur={() => {
          setIsFocused(false);
          // Late enough for a click on a suggestion to land first.
          setTimeout(() => setIsOpen(false), 200);
        }}
      />

      {isSearching ? (
        <LottieLoader
          width={16}
          height={16}
          className="absolute top-1/2 right-3 -translate-y-1/2"
        />
      ) : text ? (
        <button
          type="button"
          onClick={clear}
          aria-label={t("clear")}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {isOpen && results.length > 0 ? (
        <ul className="bg-popover absolute top-full right-0 left-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-md border shadow-lg">
          {results.map((result) => (
            <li key={`${result.lat},${result.lng}`}>
              <button
                type="button"
                className="hover:bg-accent focus-visible:bg-accent w-full px-3 py-2 text-left text-sm outline-none"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(result);
                  setText(result.label);
                  setIsOpen(false);
                }}
              >
                {result.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
