"use client";

import { useState } from "react";
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
}

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
  "SLOT_IN_PAST",
  "SLOT_NOT_ON_OFFER",
  "FORBIDDEN_NOT_SHIPPER",
  "FORBIDDEN_NOT_OPERATOR",
];

/** No wallet buttons: the card fields are the only way to pay here. */
const CARD_FORM_ONLY = {
  applePay: "never",
  googlePay: "never",
  link: "never",
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

        <DialogBody {...props} quote={quote} busy={busy} setBusy={setBusy} close={close} />
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  quote,
  close,
  ...rest
}: AcceptPaymentDialogProps & {
  quote: UseQueryResult<PaymentQuote>;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  close: () => void;
}) {
  const t = useTranslations("acceptPayment");
  const messageFor = useErrorMessage();

  if (quote.isLoading) {
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
      <>
        <ErrorLine message={messageFor(quote.error)} />
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t("close")}
          </Button>
        </DialogFooter>
      </>
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
 * On an unknown outcome every query is refetched, so the page behind shows
 * what actually happened, and the step stops offering to pay or confirm again
 * until the requester has looked.
 */
function useAcceptFailure(messages: { refused: string; unknown: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [unknown, setUnknown] = useState(false);

  const report = (cause: unknown) => {
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
  busy,
  setBusy,
  close,
}: StepProps) {
  const t = useTranslations("acceptPayment");
  const { error, setError, unknown, report } = useAcceptFailure({
    refused: t("acceptRefused"),
    unknown: t("acceptUnknown"),
  });

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
        paymentMethodTypes: ["card"],
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
  const { error, setError, unknown, report } = useAcceptFailure({
    // The server released the authorisation when it refused the award.
    refused: t("acceptFailed"),
    unknown: t("acceptUnknownPaid"),
  });

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
      setError(messageFor(cause));
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

  return (
    <div className="space-y-3">
      {/* Link off: its own "save my details" sign-up sat beside the box
          below and read as a second, different way to keep the card. Apple
          Pay and Google Pay off: production takes real money, and only the
          typed-card form was verified (pay_at_accept_spec.md §3.5). */}
      <PaymentElement options={{ layout: "tabs", wallets: CARD_FORM_ONLY }} />
      {/* Unticked: keeping a card is the requester's call, and the client
          asked for it to be possible, not assumed. */}
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
    confirmParams: { return_url: window.location.href },
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
