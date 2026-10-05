"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import {
  Package,
  MapPin,
  CalendarClock,
  Inbox,
  AlertTriangle,
  HandHelping,
  RotateCcw,
  ShieldCheck,
  Shield,
  PackageOpen,
  SearchX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/currency";
import { ApiError } from "@/lib/fetcher";
import { AcceptPaymentDialog } from "@/features/app/offers/ui/AcceptPaymentDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { PageLoader } from "@/components/ui/page-loader";
import { useJobDetail, useJobOffers, useAcceptOffer } from "../hooks/useJobDetail";
import { useListingCarriers } from "../hooks/useListingCarriers";
import { JobBidSection } from "./JobBidSection";
import { ListingReference } from "./ListingReference";
import { AvailableCarriersPanel } from "./AvailableCarriersPanel";
import { AvailabilityLine } from "./AvailabilityLine";
import { OfferCard } from "./OfferCard";
import { DraftActions } from "./DraftActions";
import { STATUS_TONE } from "../statusTone";
import type { Job } from "../types";

interface JobDetailProps {
  listingId: string;
  /** Null when signed out; drives whether offers are visible at all. */
  viewerId: string | null;
  /**
   * Viewer holds `operator` or `admin`. Escalated Expedion jobs belong to a
   * system account nobody signs into, so without this nobody could ever award
   * one. Mirrors the rule in offersService.acceptOffer exactly — including its
   * restriction to Expedion-origin jobs — so the UI never offers an award the
   * service will refuse.
   */
  isOperator?: boolean;
}

type JobTab = "details" | "carriers";

const euros = formatCurrency;

/**
 * The tab lives in the URL rather than in state so a reload, a back button and
 * a shared link all land where the reader was — the pattern MyRequestsScreen
 * set. `useSearchParams` is why page.tsx must hold a Suspense boundary.
 */
function useJobTab(listingId: string) {
  const router = useRouter();
  const params = useSearchParams();

  const tab: JobTab = params.get("tab") === "carriers" ? "carriers" : "details";

  const select = (next: string) => {
    const query = new URLSearchParams(params.toString());
    query.set("tab", next);
    router.replace(`/listing/${listingId}?${query.toString()}`, {
      scroll: false,
    });
  };

  return { tab, select };
}

export function JobDetail({
  listingId,
  viewerId,
  isOperator = false,
}: JobDetailProps) {
  const { data: job, error, isFetching, refetch } = useJobDetail(listingId);

  const isShipper = viewerId !== null && job?.shipperId === viewerId;
  const canAward = isOperator && job?.origin === "expedion";

  // Accepting an offer and seeing the carrier tab answer the same question -
  // may this viewer act on a job that is still open (carriers_on_route_spec
  // §5.2) - so the rule is written once and read twice.
  const canAct = (isShipper || canAward) && job?.status === "open";

  // react-query dedupes this with the panel's own read, so the badge costs no
  // second request; `enabled` is what keeps it from firing at all for a viewer
  // who never sees the tab.
  const { data: carriers } = useListingCarriers(listingId, canAct);

  // Never a loader forever (CLAUDE.md gotcha 9), and « introuvable » only when
  // the server says so: a dropped connection or a 500 is a failed load, with a
  // retry. A copy on screen stays when a later read fails for another reason.
  if (isGone(error)) return <JobNotFound />;
  if (!job && error && !isFetching) return <JobLoadFailed onRetry={() => void refetch()} />;
  if (!job) return <PageLoader />;

  const details = (
    <JobDetailsTab
      job={job}
      listingId={listingId}
      viewerId={viewerId}
      canAccept={canAct}
    />
  );

  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      {canAct ? (
        <JobTabs listingId={listingId} total={carriers?.total ?? 0}>
          {details}
        </JobTabs>
      ) : (
        details
      )}
    </div>
  );
}

/**
 * The two-tab strip, rendered only for someone who may act on this job. A
 * viewer who may not gets today's page with no strip at all rather than a
 * disabled one, because there is nothing behind it for them.
 */
function JobTabs({
  listingId,
  total,
  children,
}: {
  listingId: string;
  total: number;
  children: ReactNode;
}) {
  const t = useTranslations("myJobs.detail");
  const tCarriers = useTranslations("myJobs.carriers");
  const { tab, select } = useJobTab(listingId);

  return (
    <Tabs value={tab} onValueChange={select}>
      <TabsList className="w-full md:w-auto">
        <TabsTrigger value="details" className="flex-1 md:flex-none">
          {t("tab")}
        </TabsTrigger>
        <TabsTrigger value="carriers" className="flex-1 md:flex-none">
          {tCarriers("tab")}
          {total > 0 && (
            <Badge variant="secondary" className="ml-1.5 font-mono">
              {total}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="pt-4">
        {children}
      </TabsContent>

      <TabsContent value="carriers" className="pt-4">
        <AvailableCarriersPanel listingId={listingId} />
      </TabsContent>
    </Tabs>
  );
}

/** Today's page, unchanged in behaviour - now one of two tabs. */
function JobDetailsTab({
  job,
  listingId,
  viewerId,
  canAccept,
}: {
  job: Job;
  listingId: string;
  viewerId: string | null;
  canAccept: boolean;
}) {
  // Only its author can open a request not yet live (`getListing`), and
  // nobody has bid on it: what it needs is a way to finish it, not an empty
  // offers section saying carriers have been told (draft_requests_spec.md §1).
  const unpublished = job.status === "draft" || job.status === "scheduled";

  return (
    <div className="space-y-6">
      <JobHeader job={job} />
      {unpublished && <DraftBanner job={job} />}
      <JobRoute job={job} />
      <JobLoad job={job} />
      {!unpublished && (
        <>
          <JobOffers job={job} listingId={listingId} canAccept={canAccept} />
          <JobBidSection job={job} viewerId={viewerId} />
        </>
      )}
    </div>
  );
}

function DraftBanner({ job }: { job: Job }) {
  const t = useTranslations("myJobs.draft");
  const format = useFormatter();
  const router = useRouter();
  const scheduled = job.status === "scheduled";
  const datesPassed = !scheduled && new Date(job.pickupUntil) < new Date();

  return (
    <Card className="space-y-3 border-primary/30 bg-primary/5 p-4">
      <p className="text-sm">
        {scheduled && job.scheduledPublishAt
          ? t("bannerScheduled", {
              date: format.dateTime(new Date(job.scheduledPublishAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })
          : t("bannerDraft")}
      </p>
      {datesPassed && (
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />
          {t("datesPassed")}
        </p>
      )}
      <DraftActions job={job} onDeleted={() => router.replace("/listings/me")} />
    </Card>
  );
}

function JobHeader({ job }: { job: Job }) {
  const t = useTranslations("myJobs.detail");
  // The seven job statuses are already named once, for /listings/me; a second
  // vocabulary would drift from it.
  const tStatus = useTranslations("myJobs.status");

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={STATUS_TONE[job.status]}>{tStatus(job.status)}</Badge>
        {job.reopenedAt && (
          <Badge variant="outline" className="border-warning/40 text-warning">
            <RotateCcw className="mr-1 h-3 w-3" />
            {t("reopened")}
          </Badge>
        )}
        {job.isFragile && (
          <Badge variant="outline">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {t("fragile")}
          </Badge>
        )}
        {job.needsHelp && (
          <Badge variant="outline">
            <HandHelping className="mr-1 h-3 w-3" />
            {t("needsHelp")}
          </Badge>
        )}
        {job.packagingLevel && (
          <Badge variant="outline">
            <ShieldCheck className="mr-1 h-3 w-3" />
            {t(`packaging.${job.packagingLevel}`)}
          </Badge>
        )}
        {/* Work the carrier does on site, beside the state badge above —
            cargo_packaging_services_spec.md §5. */}
        {job.needsProtection && (
          <Badge variant="outline">
            <Shield className="mr-1 h-3 w-3" />
            {t("needsProtection")}
          </Badge>
        )}
        {job.needsPackaging && (
          <Badge variant="outline">
            <PackageOpen className="mr-1 h-3 w-3" />
            {t("needsPackaging")}
          </Badge>
        )}
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {job.title}
        </h1>
        <ListingReference reference={job.reference} copyable />
      </div>

      <p className="font-mono text-lg text-muted-foreground">
        {t("budget", { amount: euros(job.budgetCents) })}
      </p>
    </header>
  );
}

function JobLoad({ job }: { job: Job }) {
  const t = useTranslations("myJobs.detail");

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Package className="h-4 w-4 text-muted-foreground" />
        {t("load")}
      </h2>
      <Separator />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        <Detail label={t("weight")} value={`${job.weightKg} kg`} />
        <Detail label={t("quantity")} value={String(job.quantity)} />
        {job.lengthCm && job.widthCm && job.heightCm && (
          <Detail
            label={t("dimensions")}
            value={`${job.lengthCm} × ${job.widthCm} × ${job.heightCm} cm`}
          />
        )}
      </dl>
      <p className="text-sm leading-relaxed text-foreground/80">
        {job.description}
      </p>
    </Card>
  );
}

function JobOffers({
  job,
  listingId,
  canAccept,
}: {
  job: Job;
  listingId: string;
  canAccept: boolean;
}) {
  const t = useTranslations("myJobs.detail");
  const [sort, setSort] = useState("price_asc");
  // The offer being accepted, kept after the dialog closes so it can animate
  // out with its content rather than blanking first.
  const [accepting, setAccepting] = useState<{
    offerId: string;
    slotId?: string;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: offers } = useJobOffers(listingId, sort);
  const acceptOffer = useAcceptOffer(listingId);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {t("offers")}{" "}
          <span className="font-mono text-muted-foreground">
            ({job.offersCount})
          </span>
        </h2>

        {offers?.scope === "full" && offers.offers.length > 1 && (
          <OfferSort value={sort} onChange={setSort} />
        )}
      </div>

      <OfferSection
        offers={offers}
        job={job}
        canAccept={canAccept}
        isAccepting={acceptOffer.isPending}
        // Every accept goes through the dialog: it shows what will be debited
        // and takes the card, or confirms there is nothing to pay
        // (pay_at_accept_spec.md §2).
        onAccept={(offerId, slotId) => {
          setAccepting({ offerId, slotId });
          setDialogOpen(true);
        }}
      />

      {accepting && (
        <AcceptPaymentDialog
          key={`${accepting.offerId}:${accepting.slotId ?? ""}`}
          offerId={accepting.offerId}
          slotId={accepting.slotId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onConfirm={(paymentIntentId) =>
            acceptOffer.mutateAsync({ ...accepting, paymentIntentId })
          }
        />
      )}
    </section>
  );
}

function OfferSort({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const t = useTranslations("myJobs.detail");

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="price_asc">{t("sort.priceAsc")}</SelectItem>
        <SelectItem value="price_desc">{t("sort.priceDesc")}</SelectItem>
        <SelectItem value="rating_desc">{t("sort.ratingDesc")}</SelectItem>
        <SelectItem value="pickup_asc">{t("sort.pickupAsc")}</SelectItem>
        <SelectItem value="created_desc">{t("sort.createdDesc")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function JobRoute({ job }: { job: Job }) {
  const t = useTranslations("myJobs.detail");

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        {t("route")}
      </h2>
      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <Endpoint
          title={t("pickup")}
          address={job.pickupAddress}
          city={`${job.pickupPostalCode} ${job.pickupCity}`}
          locationType={job.pickupLocationType}
          from={job.pickupFrom}
          until={job.pickupUntil}
          days={job.pickupDays}
          periods={job.pickupPeriods}
        />
        <Endpoint
          title={t("dropoff")}
          address={job.dropoffAddress}
          city={`${job.dropoffPostalCode} ${job.dropoffCity}`}
          locationType={job.dropoffLocationType}
          from={job.dropoffFrom}
          until={job.dropoffUntil}
          days={job.dropoffDays}
          periods={job.dropoffPeriods}
        />
      </div>

      {job.isFlexible && (
        <p className="text-sm text-muted-foreground">{t("flexibleDates")}</p>
      )}
    </Card>
  );
}

/** Not there for this viewer: deleted, someone else's draft, or not theirs to see. */
const isGone = (error: unknown) =>
  error instanceof ApiError && (error.status === 404 || error.status === 403);

function JobNotFound() {
  const t = useTranslations("myJobs.detail");
  return (
    <CenteredEmptyState
      variant="page"
      icon={SearchX}
      title={t("notFound")}
      description={t("notFoundDesc")}
    >
      <Button asChild variant="outline">
        <Link href="/home">{t("backHome")}</Link>
      </Button>
    </CenteredEmptyState>
  );
}

/** Any other failure: the request may well be there, so the way on is a retry. */
function JobLoadFailed({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("myJobs.detail");
  return (
    <CenteredEmptyState
      variant="page"
      icon={AlertTriangle}
      title={t("loadError.title")}
      description={t("loadError.description")}
    >
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={onRetry}>
          {t("loadError.retry")}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/home">{t("backHome")}</Link>
        </Button>
      </div>
    </CenteredEmptyState>
  );
}

function Endpoint({
  title,
  address,
  city,
  locationType,
  from,
  until,
  days,
  periods,
}: {
  title: string;
  address?: string;
  city: string;
  locationType: string;
  from: string;
  until: string;
  days?: Job["pickupDays"];
  periods?: Job["pickupPeriods"];
}) {
  // The /create form already names every location type; reusing its catalogue
  // keeps one vocabulary for the enum instead of two that can disagree.
  const tTypes = useTranslations("create.locationTypes");
  const tDetail = useTranslations("myJobs.detail");
  const locale = useLocale();
  const dateLocale = locale === "fr" ? fr : enUS;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {address ? (
        <p className="font-medium">{address}</p>
      ) : (
        <p className="text-sm text-muted-foreground">{tDetail("addressHidden")}</p>
      )}
      <p className="text-sm text-muted-foreground">{city}</p>
      <Badge variant="outline" className="mt-1">
        {tTypes(locationType)}
      </Badge>
      <p className="flex items-center gap-1.5 pt-1 text-sm text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        {format(new Date(from), "d MMM HH:mm", { locale: dateLocale })} –{" "}
        {format(new Date(until), "d MMM HH:mm", { locale: dateLocale })}
      </p>
      {/* Indented to sit under the dates, past the calendar icon. */}
      <AvailabilityLine
        days={days}
        periods={periods}
        className="block pl-5 text-sm text-muted-foreground"
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}

/** What a carrier - or anyone else without the full view - is told instead. */
function AggregateOffers({
  count,
  lowestPriceCents,
}: {
  count: number;
  lowestPriceCents: number | null;
}) {
  const t = useTranslations("myJobs.detail");

  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{t("bidCount", { count })}</p>
      {lowestPriceCents !== null && (
        <p className="mt-1 font-mono text-lg">
          {t("lowestFrom", { amount: euros(lowestPriceCents) })}
        </p>
      )}
    </Card>
  );
}

/**
 * Renders whichever view the API granted. The scopes are the service's
 * decision, not the component's - a non-participant is never sent the offers
 * to hide (offers_engine_spec.md §6).
 */
function OfferSection({
  offers,
  job,
  canAccept,
  isAccepting,
  onAccept,
}: {
  offers: ReturnType<typeof useJobOffers>["data"];
  job: Job;
  canAccept: boolean;
  isAccepting: boolean;
  onAccept: (offerId: string, slotId?: string) => void;
}) {
  const t = useTranslations("myJobs.detail");

  if (!offers) return null;

  if (offers.scope === "aggregate") {
    return (
      <AggregateOffers
        count={offers.offersCount}
        lowestPriceCents={offers.lowestPriceCents}
      />
    );
  }

  if (offers.offers.length === 0) {
    return (
      <CenteredEmptyState
        icon={Inbox}
        title={t("noOffers")}
        description={t("noOffersDesc")}
      />
    );
  }

  const lowest = Math.min(...offers.offers.map((o) => o.priceCents));

  return (
    <div className="space-y-3">
      {offers.offers.map((offer) => (
        <OfferCard
          key={offer.id}
          offer={offer}
          budgetCents={job.budgetCents}
          canAccept={canAccept}
          isAccepting={isAccepting}
          isLowest={offer.priceCents === lowest}
          onAccept={onAccept}
        />
      ))}
    </div>
  );
}
