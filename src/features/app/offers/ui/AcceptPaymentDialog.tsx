"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { CreditCard, Lock } from "lucide-react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { Stripe, StripeElements } from "@stripe/stripe-js";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/currency";
import { ApiError } from "@/lib/fetcher";
import { getStripe } from "@/lib/stripe-client";
import { getStripeAppearance } from "@/lib/stripe-appearance";
import { offersApi, type PaymentQuote } from "../api/offers.api";
import { acceptReturnUrl, type AcceptReturn } from "../hooks/useAcceptReturn";

interface AcceptPaymentDialogProps {
  offerId: string;
  slotId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Awards the offer. `paymentIntentId` names the card authorised here, and is
   * absent when nothing is paid on this platform. Rejects when the award fails.
   */
  onConfirm: (paymentIntentId?: string) => Promise<unknown>;
  /**
   * What is being booked — pickup, delivery and the requester's delivery
   * availability — shown before any card (client_feedback_2026_10_29_spec.md
   * §N1). The caller has the offer and the job; this dialog has neither.
   */
  booking?: ReactNode;
  /**
   * Ways forward only the caller can offer, shown beside a refusal they answer
   * (no_dead_ends_spec.md §1): taking the request back to fix an address that
   * cannot be placed, and the carriers who already drive this route. Absent
   * where the caller has neither — the operator's queue, a chat bubble.
   */
  nextSteps?: {
    editRequest?: () => void;
    carriers?: () => void;
  };
  /**
   * The requester is back from a method that left the page to approve the
   * payment — PayPal — and the award is finished here, with the payment they
   * approved (payment_alternatives_spec.md §3). `failed` when they cancelled
   * or the method refused. From `useAcceptReturn`.
   */
  resume?: AcceptReturn;
}

/**
 * What the requester can do about each refusal, so none of them ends on
 * « Fermer » alone (no_dead_ends_spec.md §1). `refresh` closes and re-reads
 * the page behind, which is where another slot, another offer or the
 * request's new state is; `retry` asks for the quote again. A code not listed
 * here — a dropped connection, a 5xx — gets `retry`.
 */
type NextStep = "retry" | "chooseSlot" | "otherOffers" | "seeRequest" | "carriers" | "editRequest";

const NEXT_STEPS: Record<string, NextStep[]> = {
  COORDINATES_REQUIRED: ["editRequest"],
  SLOT_IN_PAST: ["chooseSlot"],
  SLOT_NOT_ON_OFFER: ["chooseSlot"],
  OFFER_NOT_PENDING: ["otherOffers", "carriers"],
  OFFER_NOT_FOUND: ["otherOffers", "carriers"],
  CARRIER_NO_LONGER_APPROVED: ["otherOffers", "carriers"],
  CARRIER_ABSENT: ["otherOffers", "carriers"],
  LISTING_NOT_OPEN: ["seeRequest"],
  LISTING_NOT_FOUND: ["seeRequest"],
  PAYMENT_INTENT_MISMATCH: ["retry"],
  PAYMENT_NOT_AUTHORISED: ["retry"],
  PAYMENT_NOT_REQUIRED: ["retry"],
  // Not this viewer's to award: nothing here would change that.
  FORBIDDEN_NOT_SHIPPER: [],
  FORBIDDEN_NOT_OPERATOR: [],
};

const stepsFor = (cause: unknown): NextStep[] =>
  (cause instanceof ApiError && NEXT_STEPS[cause.code]) || ["retry"];

/**
 * A refusal the whole dialog answers rather than the step: the card form is
 * no use once the offer is gone, so the next steps replace it. Payment
 * failures stay in the step, where another card is the answer.
 */
const isRefusal = (cause: unknown) =>
  cause instanceof ApiError && cause.code in NEXT_STEPS;

type Refusal = { cause: unknown; afterPay: boolean };

/** Server codes this dialog has its own wording for. */
const KNOWN_ERRORS = [
  "PAYMENT_DECLINED",
  "PAYMENT_METHOD_REQUIRED",
  "PAYMENT_NOT_REQUIRED",
  "OFFER_NOT_PENDING",
  "OFFER_NOT_FOUND",
  "LISTING_NOT_OPEN",
  "LISTING_NOT_FOUND",
  "COORDINATES_REQUIRED",
  "CARRIER_NO_LONGER_APPROVED",
  "CARRIER_ABSENT",
  // The carrier answered a counter-price after the dialog quoted (§B6).
  "PAYMENT_INTENT_MISMATCH",
  "SLOT_IN_PAST",
  "SLOT_NOT_ON_OFFER",
  "FORBIDDEN_NOT_SHIPPER",
  "FORBIDDEN_NOT_OPERATOR",
  // Back from PayPal without approving it (payment_alternatives_spec.md §3).
  "PAYMENT_NOT_AUTHORISED",
];

/**
 * Apple Pay and Google Pay beside the card fields (client_feedback_2026_10_29_spec.md
 * §C3). Both are card wallets, held with manual capture like a typed card, so
 * the award, the capture and the release are the typed-card path unchanged. `auto` shows a wallet only where it can work —
 * Apple Pay needs this domain registered under Stripe → Payment method domains
 * (STATUS.md → Operator to-do), and until it is, Stripe simply leaves the
 * button out. Link is on since 2.77.0: the owner asked for Stripe's own way to
 * pay beside the card fields (payment_alternatives_spec.md §1).
 */
const PAYMENT_WALLETS = {
  applePay: "auto",
  googlePay: "auto",
  link: "auto",
} as const;

/** A refusal from Stripe.js, which already arrives in the viewer's language. */
class StripeStepError extends Error {}

/**
 * Accepting an offer, with the payment it takes.
 *
 * The client asked that a saved card not be required, only easier
 * (pay_at_accept_spec.md §1): a saved card is one tap, and anyone else types a
 * card here and may keep it. The card is authorised before the award and
 * captured by it, so nothing is awarded unpaid and nothing is taken for an
 * award that failed.
 *
 * **Deliberately not modal.** A Radix modal disables pointer events on the
 * page and pulls focus back from anything outside itself, and a bank's 3-D
 * Secure challenge is exactly that: Stripe mounts it outside this dialog. The
 * backdrop is drawn here instead, and outside interaction is refused rather
 * than closing the dialog mid-payment.
 */
export function AcceptPaymentDialog(props: AcceptPaymentDialogProps) {
  const { offerId, slotId, open, onOpenChange } = props;
  const t = useTranslations("acceptPayment");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  // A return from PayPal is finished once; « Réessayer » goes back to the form.
  const [resumeDone, setResumeDone] = useState(false);
  const resume = props.resume && !resumeDone ? props.resume : undefined;

  const quote = useQuery({
    queryKey: ["offer-payment", offerId, slotId ?? null],
    queryFn: () => offersApi.paymentQuote(offerId, slotId),
    enabled: open,
    staleTime: 0,
    retry: false,
  });

  const close = () => {
    if (!busy) onOpenChange(false);
  };

  const retry = () => {
    setRefusal(null);
    setResumeDone(true);
    void quote.refetch();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()} modal={false}>
      <DialogPortal>
        <div
          aria-hidden
          className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0"
          onClick={close}
        />
      </DialogPortal>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-md"
        showCloseButton={!busy}
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {quote.data?.required ? t("descriptionCharge") : t("descriptionFree")}
          </DialogDescription>
        </DialogHeader>

        {props.booking}

        <DialogBody
          {...props}
          quote={quote}
          busy={busy}
          setBusy={setBusy}
          close={close}
          refusal={refusal}
          resume={resume}
          // « Not debited » is a fact only where a card was in play.
          onRefused={(cause) => setRefusal({ cause, afterPay: Boolean(quote.data?.required) })}
          retry={retry}
        />
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  quote,
  close,
  refusal,
  retry,
  ...rest
}: AcceptPaymentDialogProps & {
  quote: UseQueryResult<PaymentQuote>;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  close: () => void;
  refusal: Refusal | null;
  onRefused: (cause: unknown) => void;
  retry: () => void;
}) {
  const t = useTranslations("acceptPayment");

  if (refusal) {
    return (
      <RefusalStep {...refusal} close={close} retry={retry} nextSteps={rest.nextSteps} />
    );
  }

  if (rest.resume) return <ResumeStep {...rest} resume={rest.resume} close={close} retry={retry} />;

  // Re-reading after « Réessayer » shows the loader, but a background refetch
  // of a quote already on screen never does: it would unmount a card half
  // typed, and the 3-D Secure frame stealing focus triggers exactly that.
  if (quote.isLoading || (quote.isFetching && !quote.data)) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
        <LottieLoader width={40} height={40} />
        {t("loading")}
      </div>
    );
  }

  // A quote that cannot be read is a blank dialog otherwise (CLAUDE.md
  // gotcha 9) — and it is usually the answer itself: the offer was taken.
  if (quote.isError || !quote.data) {
    return (
      <RefusalStep
        cause={quote.error}
        afterPay={false}
        close={close}
        retry={retry}
        nextSteps={rest.nextSteps}
      />
    );
  }

  return quote.data.required ? (
    <PaymentStep {...rest} quote={quote.data} close={close} />
  ) : (
    <ConfirmStep {...rest} quote={quote.data} close={close} />
  );
}

/**
 * Whether a failed accept call is known to have changed nothing.
 *
 * A typed refusal from the server means the award did not happen: it undoes
 * the award and releases the card, so "not debited" is a fact. Anything else
 * (a dropped connection, a timeout, a 5xx) leaves the outcome unknown, and the
 * capture may already have gone through. Saying "not debited" there would be
 * a guess, and would invite a second payment.
 */
const wasRefused = (cause: unknown) =>
  cause instanceof ApiError && cause.status >= 400 && cause.status < 500;

/**
 * What a step does once its accept call has failed.
 *
 * A refusal with next steps hands the dialog over to them: the offer, the slot
 * or the request is what failed, so paying again would fail again. On an
 * unknown outcome every query is refetched, so the page behind shows what
 * actually happened, and the step stops offering to pay or confirm again until
 * the requester has looked.
 */
function useAcceptFailure(
  messages: { refused: string; unknown: string },
  onRefused: (cause: unknown) => void
) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [unknown, setUnknown] = useState(false);

  const report = (cause: unknown) => {
    if (wasRefused(cause) && isRefusal(cause)) {
      onRefused(cause);
      return;
    }
    if (wasRefused(cause)) {
      setError(messages.refused);
      return;
    }
    setUnknown(true);
    setError(messages.unknown);
    void queryClient.invalidateQueries();
  };

  return { error, setError, unknown, report };
}

/** Cancel and the step's action, or only Close once the outcome is unknown. */
function StepFooter({
  unknown,
  busy,
  disabled,
  label,
  onSubmit,
  close,
}: {
  unknown: boolean;
  busy: boolean;
  disabled?: boolean;
  label: string;
  onSubmit: () => void;
  close: () => void;
}) {
  const t = useTranslations("acceptPayment");

  if (unknown) {
    return (
      <DialogFooter>
        <Button onClick={close}>{t("close")}</Button>
      </DialogFooter>
    );
  }

  return (
    <DialogFooter>
      <Button variant="outline" onClick={close} disabled={busy}>
        {t("cancel")}
      </Button>
      <Button onClick={onSubmit} disabled={busy || disabled}>
        {busy ? t("processing") : label}
      </Button>
    </DialogFooter>
  );
}

/** Nothing is charged here: paid in Expedion, or payments are in test mode. */
function ConfirmStep({
  quote,
  onConfirm,
  onOpenChange,
  onRefused,
  busy,
  setBusy,
  close,
}: StepProps) {
  const t = useTranslations("acceptPayment");
  const { error, setError, unknown, report } = useAcceptFailure(
    { refused: t("acceptRefused"), unknown: t("acceptUnknown") },
    onRefused
  );

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Summary quote={quote} />
      <p className="text-sm text-muted-foreground">
        {quote.reason === "prepaid" ? t("prepaid") : t("mock")}
      </p>
      {error && <ErrorLine message={error} />}
      <StepFooter
        unknown={unknown}
        busy={busy}
        label={t("confirm")}
        onSubmit={confirm}
        close={close}
      />
    </>
  );
}

type StepProps = AcceptPaymentDialogProps & {
  quote: PaymentQuote;
  onRefused: (cause: unknown) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  close: () => void;
};

/**
 * The card form lives in a deferred Elements group — mode, amount and capture
 * method up front, the intent created only when Pay is pressed — so opening
 * and closing the dialog leaves nothing behind at Stripe. `setupFutureUsage`
 * follows the checkbox, and must: the intent is created with the same value,
 * and Stripe refuses a confirmation where the two disagree.
 */
function PaymentStep(props: StepProps) {
  const t = useTranslations("acceptPayment");
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const [stripePromise] = useState(() => getStripe());
  const [saveCard, setSaveCard] = useState(false);

  if (!stripePromise) return <ErrorLine message={t("errors.stripeUnavailable")} />;

  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: "payment",
        amount: props.quote.totalCents,
        currency: "eur",
        captureMethod: "manual",
        // No list: the Stripe Dashboard decides — card, Link, PayPal once
        // switched on there — filtered to what can be held until capture
        // (payment_alternatives_spec.md §2). The intent is created the same way.
        setupFutureUsage: saveCard ? "off_session" : null,
        locale: locale === "fr" ? "fr" : "en",
        appearance: getStripeAppearance(resolvedTheme),
      }}
    >
      <PaymentForm {...props} saveCard={saveCard} setSaveCard={setSaveCard} />
    </Elements>
  );
}

function PaymentForm({
  quote,
  offerId,
  slotId,
  onConfirm,
  onOpenChange,
  onRefused,
  busy,
  setBusy,
  close,
  saveCard,
  setSaveCard,
}: StepProps & { saveCard: boolean; setSaveCard: (save: boolean) => void }) {
  const t = useTranslations("acceptPayment");
  const stripe = useStripe();
  const elements = useElements();
  const messageFor = useErrorMessage();
  const [method, setMethod] = useState<"saved" | "new">(
    quote.savedCard ? "saved" : "new"
  );
  const { error, setError, unknown, report } = useAcceptFailure(
    // The server released the authorisation when it refused the award.
    { refused: t("acceptFailed"), unknown: t("acceptUnknownPaid") },
    onRefused
  );

  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);

    let intentId: string;
    try {
      intentId =
        method === "saved"
          ? await authoriseSaved(stripe, offerId, slotId)
          : await authoriseNew(stripe, elements, { offerId, slotId, saveCard });
    } catch (cause) {
      // Refused before any card was confirmed — the award's own checks run at
      // authorisation too (pay_at_accept_spec.md §4).
      if (isRefusal(cause)) onRefused(cause);
      else setError(messageFor(cause));
      setBusy(false);
      return;
    }

    try {
      await onConfirm(intentId);
      onOpenChange(false);
    } catch (cause) {
      report(cause);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Summary quote={quote} />

      {quote.savedCard && (
        <CardChoice
          savedCard={quote.savedCard}
          value={method}
          onChange={setMethod}
          disabled={busy}
        />
      )}

      {method === "new" && (
        <NewCardFields saveCard={saveCard} setSaveCard={setSaveCard} disabled={busy} />
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        {t("secure")}
      </p>

      {error && <ErrorLine message={error} />}

      <StepFooter
        unknown={unknown}
        busy={busy}
        disabled={!stripe || !elements}
        label={t("pay", { amount: formatCurrency(quote.totalCents) })}
        onSubmit={pay}
        close={close}
      />
    </>
  );
}

/** The card form, and the opt-in to keep the card for next time. */
function NewCardFields({
  saveCard,
  setSaveCard,
  disabled,
}: {
  saveCard: boolean;
  setSaveCard: (save: boolean) => void;
  disabled: boolean;
}) {
  const t = useTranslations("acceptPayment");
  // The method chosen in the form. Only a card is kept for next time: a
  // PayPal account cannot be charged later without PayPal's own billing
  // agreement, and ticking the box hides every method that cannot be kept.
  const [method, setMethod] = useState("card");

  return (
    <div className="space-y-3">
      {/* Card, Link, PayPal and whatever else the Stripe Dashboard allows;
          Apple Pay and Google Pay where the browser and the domain allow them
          (§C3 of the 29 October spec); see PAYMENT_WALLETS. */}
      <PaymentElement
        options={{ layout: "tabs", wallets: PAYMENT_WALLETS }}
        onChange={(event) => {
          setMethod(event.value.type);
          if (event.value.type !== "card") setSaveCard(false);
        }}
      />
      {/* Unticked: keeping a card is the requester's call, and the client
          asked for it to be possible, not assumed. */}
      {method === "card" && (
        <div className="flex items-start gap-2">
          <Checkbox
            id="accept-save-card"
            checked={saveCard}
            onCheckedChange={(checked) => setSaveCard(checked === true)}
            disabled={disabled}
          />
          <div className="grid gap-0.5">
            <Label htmlFor="accept-save-card" className="text-sm font-normal">
              {t("saveCard")}
            </Label>
            <p className="text-xs text-muted-foreground">{t("saveCardHint")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The saved card, confirmed on the server. A bank that wants 3-D Secure
 * answers `requires_action`, which Stripe.js puts in front of the requester.
 */
async function authoriseSaved(stripe: Stripe, offerId: string, slotId?: string) {
  const prepared = await offersApi.preparePayment(offerId, {
    method: "saved",
    slotId,
  });
  if (prepared.status === "requires_capture") return prepared.paymentIntentId;

  if (prepared.status === "requires_action" && prepared.clientSecret) {
    const { error, paymentIntent } = await stripe.handleNextAction({
      clientSecret: prepared.clientSecret,
    });
    if (error) throw new StripeStepError(error.message);
    if (paymentIntent?.status === "requires_capture") return paymentIntent.id;
  }

  throw new StripeStepError();
}

/** A card typed into the form, confirmed by Stripe.js against a fresh intent. */
async function authoriseNew(
  stripe: Stripe,
  elements: StripeElements,
  input: { offerId: string; slotId?: string; saveCard: boolean }
) {
  // Validates the form before anything exists at Stripe.
  const { error: formError } = await elements.submit();
  if (formError) throw new StripeStepError(formError.message);

  const prepared = await offersApi.preparePayment(input.offerId, {
    method: "new",
    saveCard: input.saveCard,
    slotId: input.slotId,
  });
  if (!prepared.clientSecret) throw new StripeStepError();

  const { error, paymentIntent } = await stripe.confirmPayment({
    elements,
    clientSecret: prepared.clientSecret,
    redirect: "if_required",
    // PayPal leaves the page to be approved and comes back here, naming the
    // award, where `useAcceptReturn` finishes it (§3). A card stays in place.
    confirmParams: { return_url: acceptReturnUrl(input.offerId, input.slotId) },
  });
  if (error) throw new StripeStepError(error.message);
  if (paymentIntent?.status !== "requires_capture") throw new StripeStepError();

  return paymentIntent.id;
}

function Summary({ quote }: { quote: PaymentQuote }) {
  const t = useTranslations("acceptPayment");
  const showFee = quote.platformFeeCents > 0;

  return (
    <dl className="space-y-1.5 rounded-lg border p-4 text-sm">
      {showFee && (
        <>
          <Row label={t("price")} value={formatCurrency(quote.priceCents)} />
          <Row label={t("fee")} value={formatCurrency(quote.platformFeeCents)} />
          <Separator className="my-2" />
        </>
      )}
      <Row
        label={
          quote.required
            ? t("total")
            : // Test mode still shows the fee, so its bottom line is a total,
              // just not one anybody is debited.
              showFee
              ? t("totalNotCharged")
              : t("offerAmount")
        }
        value={formatCurrency(quote.totalCents)}
        strong
      />
    </dl>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd className={`font-mono tabular-nums ${strong ? "text-base font-semibold" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function CardChoice({
  savedCard,
  value,
  onChange,
  disabled,
}: {
  savedCard: NonNullable<PaymentQuote["savedCard"]>;
  value: "saved" | "new";
  onChange: (value: "saved" | "new") => void;
  disabled: boolean;
}) {
  const t = useTranslations("acceptPayment");
  const brand = savedCard.brand.charAt(0).toUpperCase() + savedCard.brand.slice(1);

  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(next === "new" ? "new" : "saved")}
      aria-label={t("payWith")}
      className="gap-2"
    >
      <Label
        htmlFor="accept-card-saved"
        className="flex items-center gap-3 rounded-lg border p-3 font-normal"
      >
        <RadioGroupItem value="saved" id="accept-card-saved" disabled={disabled} />
        <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>{t("savedCard", { brand, last4: savedCard.last4 })}</span>
      </Label>
      <Label
        htmlFor="accept-card-new"
        className="flex items-center gap-3 rounded-lg border p-3 font-normal"
      >
        <RadioGroupItem value="new" id="accept-card-new" disabled={disabled} />
        <span>{t("otherCard")}</span>
      </Label>
    </RadioGroup>
  );
}

/**
 * Back from PayPal: the award is finished with the payment the requester
 * approved there (payment_alternatives_spec.md §3), once — a reload or a
 * re-render must not try it twice. Cancelled at PayPal, it says so and goes
 * back to the form; any refusal goes through the same steps as a Pay press.
 */
function ResumeStep({
  resume,
  onConfirm,
  onOpenChange,
  onRefused,
  setBusy,
  close,
  retry,
}: AcceptPaymentDialogProps & {
  resume: AcceptReturn;
  onRefused: (cause: unknown) => void;
  setBusy: (busy: boolean) => void;
  close: () => void;
  retry: () => void;
}) {
  const t = useTranslations("acceptPayment");
  const started = useRef(false);
  const { error, unknown, report } = useAcceptFailure(
    { refused: t("acceptFailed"), unknown: t("acceptUnknownPaid") },
    onRefused
  );

  useEffect(() => {
    if (resume.failed || started.current) return;
    started.current = true;
    setBusy(true);
    onConfirm(resume.paymentIntentId)
      .then(() => onOpenChange(false))
      .catch(report)
      .finally(() => setBusy(false));
  }, [resume, onConfirm, onOpenChange, report, setBusy]);

  if (!resume.failed && !error) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
        <LottieLoader width={40} height={40} />
        {t("finishing")}
      </div>
    );
  }

  return (
    <>
      <ErrorLine message={error ?? t("redirectFailed")} />
      <DialogFooter className="flex-wrap gap-2">
        <Button variant="outline" onClick={close}>
          {t("close")}
        </Button>
        {!unknown && <Button onClick={retry}>{t("next.retry")}</Button>}
      </DialogFooter>
    </>
  );
}

/**
 * Why this offer cannot be accepted, and what to do instead
 * (no_dead_ends_spec.md §1). « Fermer » is always there; it is never alone.
 */
function RefusalStep({
  cause,
  afterPay,
  close,
  retry,
  nextSteps,
}: Refusal & {
  close: () => void;
  retry: () => void;
  nextSteps: AcceptPaymentDialogProps["nextSteps"];
}) {
  const t = useTranslations("acceptPayment");
  const messageFor = useErrorMessage();
  const queryClient = useQueryClient();

  // Another slot, another offer, the request as it now is: all on the page
  // behind, which is re-read so it shows the truth.
  const refresh = () => {
    void queryClient.invalidateQueries();
    close();
  };
  const handoff = (action: () => void) => () => {
    close();
    action();
  };

  const actions: Record<NextStep, (() => void) | undefined> = {
    retry,
    chooseSlot: refresh,
    otherOffers: refresh,
    seeRequest: refresh,
    carriers: nextSteps?.carriers && handoff(nextSteps.carriers),
    editRequest: nextSteps?.editRequest && handoff(nextSteps.editRequest),
  };
  const steps = stepsFor(cause).filter((step) => actions[step]);

  return (
    <>
      <ErrorLine message={messageFor(cause)} />
      {afterPay && <p className="text-sm text-muted-foreground">{t("notDebited")}</p>}
      <DialogFooter className="flex-wrap gap-2">
        <Button variant="outline" onClick={close}>
          {t("close")}
        </Button>
        {steps.map((step, index) => (
          <Button
            key={step}
            variant={index === 0 ? "default" : "outline"}
            onClick={actions[step]}
          >
            {t(`next.${step}`)}
          </Button>
        ))}
      </DialogFooter>
    </>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </p>
  );
}

/** One wording per failure, whichever step raised it. */
function useErrorMessage() {
  const t = useTranslations("acceptPayment");

  return (cause: unknown) => {
    if (cause instanceof StripeStepError) {
      return cause.message || t("errors.notAuthorised");
    }
    if (cause instanceof ApiError && KNOWN_ERRORS.includes(cause.code)) {
      return t(`errors.${cause.code}`);
    }
    return t("errors.generic");
  };
}
