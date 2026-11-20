"use client";

import { useCallback, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Mic, Sparkles, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { countryName, DEFAULT_COUNTRY } from "@/lib/countries";
import { ApiError } from "@/lib/fetcher";
import { numberToInput } from "@/lib/numeric-input";
import {
  ASSISTANT_FIELDS,
  ASSISTANT_TEXT_MAX,
  type AssistantEnd,
  type AssistantField,
  type RequestDraft,
} from "@/server/dto/request-assistant.dto";
import { ASSISTANT_TIMEOUT } from "../api/assistant.api";
import { hasFindings } from "../assistant";
import { useRequestAssistant } from "../hooks/useRequestAssistant";
import { useVoiceInput } from "../hooks/useVoiceInput";

interface RequestAssistantProps {
  /** Write the reading onto the form. Nothing is saved or posted by it. */
  onApply: (draft: RequestDraft) => void;
}

/**
 * « Décrivez votre demande » — say it in a sentence, typed or spoken, and the
 * form below opens already filled (docs/specs/request_assistant_spec.md §4).
 *
 * It is a shortcut onto the form and never around it: the reading is shown
 * for the person to check, « Remplir le formulaire » writes it onto the same
 * fields they would have typed in, and the four steps and « Publier » are
 * still theirs. Renders nothing where the assistant cannot answer.
 */
export function RequestAssistant({ onApply }: RequestAssistantProps) {
  const t = useTranslations("create.assistant");
  const assistant = useRequestAssistant();
  const [text, setText] = useState("");
  const [applied, setApplied] = useState(false);

  const addSpoken = useCallback(
    (spoken: string) =>
      setText((current) =>
        [current.trim(), spoken].filter(Boolean).join(" ").slice(0, ASSISTANT_TEXT_MAX)
      ),
    []
  );
  const voice = useVoiceInput(addSpoken);

  if (!assistant.available) return null;

  const { draft } = assistant;
  const busy = assistant.isReading || voice.state !== "idle";
  const nextQuestion = draft?.missing[0];

  // The sentence stays in the box until it has been read: a call that fails
  // or runs out of time leaves it there, ready to be sent again.
  const read = () => assistant.say(text, () => setText(""));

  const fill = () => {
    if (!draft) return;
    onApply(draft);
    setApplied(true);
  };

  const startOver = () => {
    assistant.reset();
    setText("");
    setApplied(false);
  };

  if (applied) {
    return (
      <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary/5 p-4">
        <p className="flex items-start gap-2 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <span className="font-medium">{t("applied")}</span>{" "}
            <span className="text-muted-foreground">{t("appliedHint")}</span>
          </span>
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={startOver}>
          {t("describeAgain")}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="gap-4 border-primary/30 bg-primary/5 p-4 sm:p-5">
      <div className="space-y-1">
        <h2 className="flex items-start gap-2 font-semibold">
          <Sparkles className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>

      {draft && <Reading draft={draft} />}

      <div className="space-y-2">
        <Label htmlFor="assistant-text">
          {draft
            ? nextQuestion
              ? t(`ask.${nextQuestion}`)
              : t("askMore")
            : t("label")}
        </Label>
        <Textarea
          id="assistant-text"
          rows={draft ? 2 : 3}
          maxLength={ASSISTANT_TEXT_MAX}
          placeholder={draft ? undefined : t("placeholder")}
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={busy}
        />
      </div>

      <Problem error={assistant.error} voice={voice.problem} />

      <div className="flex flex-wrap items-center gap-2">
        {draft && (
          <Button type="button" onClick={fill} disabled={busy || !hasFindings(draft)}>
            {t("fill")}
          </Button>
        )}
        <Button
          type="button"
          variant={draft ? "outline" : "default"}
          onClick={read}
          disabled={busy || text.trim().length < 3}
        >
          {assistant.isReading && (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          )}
          {assistant.isReading
            ? t("reading")
            : assistant.error
              ? t("retry")
              : draft
                ? t("add")
                : t("read")}
        </Button>
        {voice.supported && <MicButton voice={voice} disabled={assistant.isReading} />}
        {draft && (
          <Button type="button" variant="ghost" onClick={startOver} disabled={busy}>
            {t("restart")}
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{t("privacy")}</p>
    </Card>
  );
}

function MicButton({
  voice,
  disabled,
}: {
  voice: ReturnType<typeof useVoiceInput>;
  disabled: boolean;
}) {
  const t = useTranslations("create.assistant");
  if (voice.state === "recording") {
    return (
      <Button type="button" variant="destructive" onClick={voice.stop}>
        <Square className="size-4" aria-hidden="true" />
        {t("stopRecording")}
      </Button>
    );
  }
  const transcribing = voice.state === "transcribing";
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void voice.start()}
      disabled={disabled || transcribing}
    >
      {transcribing ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Mic className="size-4" aria-hidden="true" />
      )}
      {transcribing ? t("transcribing") : t("record")}
    </Button>
  );
}

/** What went wrong, and what to do about it — the form below always works. */
function Problem({
  error,
  voice,
}: {
  error: unknown;
  voice: "denied" | "failed" | null;
}) {
  const t = useTranslations("create.assistant");
  const code = error instanceof ApiError ? error.code : null;
  const message = error
    ? t(
        code === "RATE_LIMITED"
          ? "error.rateLimited"
          : code === ASSISTANT_TIMEOUT
            ? "error.timeout"
            : "error.failed"
      )
    : voice
      ? t(voice === "denied" ? "error.micDenied" : "error.micFailed")
      : null;
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

/** A calendar day as a person reads it: « vendredi 20 novembre ». */
function useDayText() {
  const format = useFormatter();
  // Noon UTC, shown in UTC: the day is a day, whatever the browser's zone.
  return (day: string) =>
    format.dateTime(new Date(`${day}T12:00:00Z`), {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
}

/** What the reading holds for each field, in words; `null` where it holds nothing. */
function useReadingValues(draft: RequestDraft): Record<AssistantField, string | null> {
  const t = useTranslations("create.assistant");
  const tWhat = useTranslations("create.what");
  const locale = useLocale();
  const dayText = useDayText();

  const end = (place: AssistantEnd | null) =>
    place &&
    [
      place.postalCode ? `${place.city} (${place.postalCode})` : place.city,
      place.country !== DEFAULT_COUNTRY ? countryName(place.country, locale) : null,
    ]
      .filter(Boolean)
      .join(", ");

  const cm = (value: number) => numberToInput(value, 1, locale);
  const { pickupDate, deliveryDate } = draft;

  return {
    title:
      draft.title && draft.quantity && draft.quantity > 1
        ? t("quantity", { title: draft.title, count: draft.quantity })
        : draft.title,
    size: draft.dimensions
      ? t("dimensions", {
          lengthCm: cm(draft.dimensions.lengthCm),
          widthCm: cm(draft.dimensions.widthCm),
          heightCm: cm(draft.dimensions.heightCm),
        })
      : draft.sizePreset && tWhat(`sizePresets.${draft.sizePreset}.label`),
    weight:
      draft.exactWeightKg !== null
        ? t("kilograms", { kg: numberToInput(draft.exactWeightKg, 1, locale) })
        : draft.weightBracket && tWhat(`weightBrackets.${draft.weightBracket}.label`),
    pickup: end(draft.pickup),
    dropoff: end(draft.dropoff),
    when:
      pickupDate && deliveryDate
        ? t("dates.both", { pickup: dayText(pickupDate), delivery: dayText(deliveryDate) })
        : pickupDate
          ? t("dates.pickup", { date: dayText(pickupDate) })
          : deliveryDate && t("dates.delivery", { date: dayText(deliveryDate) }),
  };
}

/** The reading, field by field, with what is still to be said marked as such. */
function Reading({ draft }: { draft: RequestDraft }) {
  const t = useTranslations("create.assistant");
  const values = useReadingValues(draft);
  const outOfArea = (field: AssistantField) =>
    (field === "pickup" || field === "dropoff") && draft.outOfArea.includes(field);

  return (
    <div className="space-y-2 rounded-md border bg-background p-3">
      <p className="text-sm font-medium">
        {t(hasFindings(draft) ? "understood" : "nothing")}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {ASSISTANT_FIELDS.map((field) => (
          <div key={field} className="contents">
            <dt className="text-muted-foreground">{t(`fields.${field}`)}</dt>
            <dd className={values[field] ? "font-medium" : "text-muted-foreground"}>
              {values[field] ?? (outOfArea(field) ? t("outOfArea") : t("toSpecify"))}
            </dd>
          </div>
        ))}
      </dl>
      {hasFindings(draft) && (
        <p className="text-xs text-muted-foreground">{t("checkNote")}</p>
      )}
    </div>
  );
}
