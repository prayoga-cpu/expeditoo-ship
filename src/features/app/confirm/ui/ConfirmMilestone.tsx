"use client";

import { useTranslations } from "next-intl";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  LinkIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import {
  useConfirmationSubject,
  useSubmitConfirmation,
} from "../hooks/useConfirmation";

/**
 * The public one-tap page an SMS or email link lands on.
 *
 * Standalone rather than wrapped in the marketing shell: the reader arrived
 * from a text message to answer one question, and a nav bar and a footer are
 * two more things between them and the button.
 *
 * Every terminal state is a card with the same shape, including the ones that
 * are not successes — someone who taps a dead link must be told what happened,
 * not shown an empty page.
 */
export function ConfirmMilestone({ token }: { token: string }) {
  const t = useTranslations("confirm");
  const { subject, isLoading, isError, isInvalidToken } =
    useConfirmationSubject(token);
  const { submit, isPending, isDone, isError: submitFailed } =
    useSubmitConfirmation(token);

  if (isLoading) return <PageLoader />;

  if (isError || !subject) {
    return (
      <Outcome
        icon={LinkIcon}
        tone="muted"
        title={isInvalidToken ? t("invalid.title") : t("unavailable.title")}
        body={isInvalidToken ? t("invalid.body") : t("unavailable.body")}
      />
    );
  }

  // `isDone` first, and on its own. The successful mutation invalidates the
  // describe query, so by the time the refetch lands `alreadyConfirmed` is
  // true — reading it here told a client who had just confirmed for the first
  // time that they had already done it.
  if (isDone) {
    return (
      <Outcome
        icon={CheckCircle2}
        tone="success"
        title={t("done.title")}
        body={t("done.body")}
      />
    );
  }

  if (subject.alreadyConfirmed) {
    return (
      <Outcome
        icon={CheckCircle2}
        tone="success"
        title={t("already.title")}
        body={t("already.body")}
      />
    );
  }

  // A cancelled run has nothing to confirm and no further message coming, so
  // it must not borrow the "not yet" copy that promises one.
  if (subject.cancelled) {
    return (
      <Outcome
        icon={LinkIcon}
        tone="muted"
        title={t("cancelled.title")}
        body={t("cancelled.body")}
      />
    );
  }

  // The transporter has not got there yet. Saying so beats offering a button
  // that the service would refuse with MILESTONE_NOT_REACHED.
  if (!subject.confirmable) {
    return (
      <Outcome
        icon={Clock}
        tone="muted"
        title={t("notYet.title")}
        body={t("notYet.body")}
      />
    );
  }

  return (
    <Shell>
      <h1 className="text-xl font-semibold tracking-tight">
        {t(`title.${subject.milestone}`)}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t(`lead.${subject.milestone}`)}
      </p>

      <dl className="mt-6 space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
        {subject.pickupCity && subject.dropoffCity && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("route")}
            </dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2">
              <span>{subject.pickupCity}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{subject.dropoffCity}</span>
            </dd>
          </div>
        )}
        {subject.reference && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("reference")}
            </dt>
            <dd className="mt-1">{subject.reference}</dd>
          </div>
        )}
      </dl>

      <Button
        className="mt-6 w-full gap-2"
        size="lg"
        onClick={submit}
        disabled={isPending}
      >
        <CheckCircle2 className="h-5 w-5" />
        {isPending ? t("submitting") : t(`action.${subject.milestone}`)}
      </Button>

      {submitFailed && (
        <p className="mt-3 text-center text-sm text-destructive">{t("error")}</p>
      )}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t("disclaimer")}
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 sm:p-8">{children}</CardContent>
      </Card>
    </div>
  );
}

const TONES = {
  success: "text-primary",
  muted: "text-muted-foreground",
} as const;

function Outcome({
  icon: Icon,
  tone,
  title,
  body,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  title: string;
  body: string;
}) {
  return (
    <Shell>
      <div className="flex flex-col items-center text-center">
        <Icon className={`h-10 w-10 ${TONES[tone]}`} />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </div>
    </Shell>
  );
}
