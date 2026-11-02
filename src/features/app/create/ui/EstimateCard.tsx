"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { usePriceSuggestion } from "../hooks/usePriceSuggestion";
import type { JobFormApi } from "../hooks/useJobForm";

/**
 * « Estimation du prix » on the Budget step (client_feedback_2026_10_31_spec.md
 * §4): the platform's rate card read as a range, and a way to take its middle
 * as the budget. Advice, not a price: the requester types their own, and the
 * carriers bid. Where the rate card does not apply it says so, and why.
 */
export function EstimateCard({ form }: { form: JobFormApi["form"] }) {
  const t = useTranslations("create.budget.estimate");
  const { setValue, watch } = form;
  const isMoving = watch("jobKind") === "moving";

  const { data: suggestion, isFetching } = usePriceSuggestion({
    pickup: watch("pickup") ?? {},
    dropoff: watch("dropoff") ?? {},
    jobKind: watch("jobKind"),
    quantity: watch("quantity") as string | number | undefined,
    weightBracket: watch("weightBracket"),
    exactWeightKg: watch("exactWeightKg") as string | undefined,
    sizeMode: watch("sizeMode"),
    sizePreset: watch("sizePreset"),
    lengthCm: watch("lengthCm") as string | undefined,
    widthCm: watch("widthCm") as string | undefined,
    heightCm: watch("heightCm") as string | undefined,
  });

  const euros = (cents: number) => formatCurrency(cents, { fractionDigits: 0 });

  if (!suggestion) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
        {isFetching ? t("loading") : t(isMoving ? "moving" : "none")}
      </p>
    );
  }

  const middle = Math.round((suggestion.lowCents + suggestion.highCents) / 2 / 100);

  return (
    <div className="space-y-2 rounded-lg border bg-primary/5 px-4 py-3">
      <p className="text-sm font-medium text-muted-foreground">{t("title")}</p>
      <p className="font-mono text-2xl font-semibold tabular-nums">
        {euros(suggestion.lowCents)} – {euros(suggestion.highCents)}
      </p>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto p-0"
        onClick={() =>
          // Whole euros, digits only: a grouping space (« 1 000 ») is not
          // something the money box types.
          setValue("budgetEuros", String(middle), {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      >
        {t("use", { amount: euros(middle * 100) })}
      </Button>
      <p className="text-xs text-muted-foreground">{t("footnote")}</p>
    </div>
  );
}

const STEPS = ["offers", "choose", "pay", "payout"] as const;

/**
 * « Comment ça marche ? »: what happens after « Publier », in four steps, in
 * this platform's order — the requester pays when they accept an offer, and
 * the transporter is paid once the goods are delivered (spec §4).
 */
export function HowItWorks() {
  const t = useTranslations("create.budget.howItWorks");

  return (
    <section aria-labelledby="how-it-works" className="space-y-2">
      <h3 id="how-it-works" className="text-sm font-semibold">
        {t("title")}
      </h3>
      <ol className="space-y-2">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-start gap-3 text-sm">
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
            >
              {index + 1}
            </span>
            <span className="pt-0.5">{t(step)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
