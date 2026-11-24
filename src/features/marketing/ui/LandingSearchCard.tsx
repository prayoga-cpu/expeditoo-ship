"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type Ref,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, CalendarDays, MapPin, Navigation, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildCreateUrl,
  EMPTY_SEARCH,
  EXAMPLE_ROUTES,
  SEARCH_TITLE_MAX,
  SEARCH_TOWN_MAX,
  type LandingSearchValues,
} from "../landing-search";

/** Today as the date input reads it, in the visitor's own calendar. */
function todayForInput(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

interface FieldProps {
  name: keyof LandingSearchValues;
  label: string;
  icon: ComponentType<{ className?: string }>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "date";
  maxLength?: number;
  min?: string;
  inputRef?: Ref<HTMLInputElement>;
  autoComplete?: string;
}

/**
 * One box: the icon, its label above, the input below. The whole box is the
 * `<label>`, so a press anywhere in it focuses the input; the input's name
 * comes from `aria-labelledby` alone, so it reads « Ville de départ » and not
 * « Ville de départ Paris » once something is typed.
 */
function SearchField({ name, label, icon: Icon, inputRef, onChange, ...input }: FieldProps) {
  const labelId = useId();
  return (
    <label
      className={cn(
        "flex min-h-[60px] cursor-text items-center gap-3 rounded-xl border px-3.5 py-2 transition-colors",
        "border-[#dfe4ec] bg-[#f6f8fb] hover:border-[#c5cdd9]",
        "dark:border-[#22385e] dark:bg-[#0a1a36] dark:hover:border-[#2f4a78]",
        "focus-within:border-primary focus-within:bg-white focus-within:ring-[3px] focus-within:ring-[rgb(7_107_227/0.22)]",
        "dark:focus-within:bg-[#0a1a36] dark:focus-within:ring-[rgb(91_157_255/0.3)]"
      )}
    >
      <Icon className="h-5 w-5 flex-none text-[#5b6675] dark:text-[#9fb0c8]" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col">
        <span id={labelId} className="text-[0.75rem] leading-tight font-semibold text-[#3d4652] dark:text-[#c6d3e8]">
          {label}
        </span>
        <input
          ref={inputRef}
          name={name}
          aria-labelledby={labelId}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "w-full min-w-0 border-0 bg-transparent p-0 text-[0.95rem] text-[#0f1722] outline-none",
            "placeholder:text-[#6f7985] dark:text-[#eef2f6] dark:placeholder:text-[#8193ad]",
            "[color-scheme:light] dark:[color-scheme:dark]"
          )}
          {...input}
        />
      </span>
    </label>
  );
}

/**
 * The hero's search card: Ville de départ · Destination · Date · « Que
 * transportez-vous ? », and one button that opens `/create` with the four
 * values (landing_2026_11_spec.md §2). The client asked for the title where
 * the reference had « Date exacte » (19 Nov).
 *
 * It is a real GET form on `/create`, so it still works before the script
 * has loaded; once it has, the submit builds a clean link without the empty
 * keys. A signed-out visitor is sent to sign in by `/create` itself and
 * brought back with the values.
 */
export function LandingSearchCard() {
  const t = useTranslations("marketing.search");
  const router = useRouter();
  const [values, setValues] = useState<LandingSearchValues>(EMPTY_SEARCH);
  // The earliest day the date input offers. Set after mount: the server's
  // "today" and the visitor's may be different days.
  const [minDate, setMinDate] = useState<string | undefined>(undefined);
  useEffect(() => setMinDate(todayForInput()), []);
  const titleRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof LandingSearchValues) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildCreateUrl(values));
  }

  function applyRoute(route: (typeof EXAMPLE_ROUTES)[number]) {
    setValues((current) => ({ ...current, from: route.from, to: route.to }));
    // What is still missing is what they are sending.
    if (!values.title.trim()) titleRef.current?.focus();
  }

  return (
    <form
      action="/create"
      method="get"
      onSubmit={handleSubmit}
      aria-label={t("label")}
      className="w-full rounded-[20px] bg-white p-3 text-[#0f1722] shadow-[0_24px_60px_-28px_rgba(4,24,64,0.55)] ring-1 ring-[rgb(0_0_0/0.05)] sm:p-4 dark:bg-[#0d2144] dark:text-[#eef2f6] dark:ring-[rgb(255_255_255/0.1)]"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5">
        <SearchField
          name="from"
          label={t("from.label")}
          placeholder={t("from.placeholder")}
          icon={MapPin}
          value={values.from}
          onChange={set("from")}
          maxLength={SEARCH_TOWN_MAX}
          autoComplete="address-level2"
        />
        <SearchField
          name="to"
          label={t("to.label")}
          placeholder={t("to.placeholder")}
          icon={Navigation}
          value={values.to}
          onChange={set("to")}
          maxLength={SEARCH_TOWN_MAX}
          autoComplete="off"
        />
        <SearchField
          name="date"
          type="date"
          label={t("date.label")}
          icon={CalendarDays}
          value={values.date}
          onChange={set("date")}
          min={minDate}
        />
        <SearchField
          name="title"
          label={t("title.label")}
          placeholder={t("title.placeholder")}
          icon={Package}
          value={values.title}
          onChange={set("title")}
          maxLength={SEARCH_TITLE_MAX}
          inputRef={titleRef}
          autoComplete="off"
        />
      </div>

      <button
        type="submit"
        className="mt-2.5 flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[1rem] font-semibold text-white transition-colors hover:bg-[#055bc4] focus-visible:ring-[3px] focus-visible:ring-[rgb(7_107_227/0.4)] focus-visible:ring-offset-2 focus-visible:outline-none sm:mt-3"
      >
        {t("submit")}
        <ArrowRight className="h-[18px] w-[18px]" aria-hidden />
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 px-1 pb-0.5">
        <span className="text-[0.8rem] text-[#5b6675] dark:text-[#9fb0c8]">{t("examples")}</span>
        {EXAMPLE_ROUTES.map((route) => (
          <button
            key={`${route.from}-${route.to}`}
            type="button"
            onClick={() => applyRoute(route)}
            aria-label={t("exampleFill", route)}
            className="cursor-pointer rounded-full border border-[#dfe4ec] bg-white px-3 py-1 text-[0.8rem] font-medium text-[#0b4fb0] transition-colors hover:border-primary hover:bg-[#eef4fe] focus-visible:ring-[3px] focus-visible:ring-[rgb(7_107_227/0.3)] focus-visible:outline-none dark:border-[#22385e] dark:bg-transparent dark:text-[#8fb8ff] dark:hover:bg-[#12284f]"
          >
            {t("exampleRoute", route)}
          </button>
        ))}
      </div>
    </form>
  );
}
