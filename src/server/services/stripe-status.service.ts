import { stripe } from "@/lib/stripe";
import { isMockPaymentsEnabled } from "@/lib/stripe/mock-payments";
import { paymentsDal } from "@/server/dal/payments.dal";
import { stripeWebhookHeartbeatDal } from "@/server/dal/stripe-webhook-heartbeat.dal";
import { userHasRole } from "@/server/dal/users.dal";
import { HANDLED_STRIPE_EVENTS } from "@/server/services/stripe.service";

// ========================================
// Stripe check — launch_readiness_spec.md §B
// ========================================
//
// Answers, from inside the deployment, the questions no laptop can: are the
// keys live, does Stripe reach the webhook, has a real card ever been charged.
// Read-only — nothing here writes to Stripe or to the database.

export class StripeStatusError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message?: string
  ) {
    super(message ?? code);
    this.name = "StripeStatusError";
  }
}

export type KeyMode = "live" | "test" | "missing" | "unknown";
export type CheckState = "ok" | "todo" | "fail";

export type CheckKey =
  | "liveKeys"
  | "mockOff"
  | "chargesEnabled"
  | "webhookEndpoint"
  | "webhookReceived"
  | "firstRealPayment";

export interface StripeCheck {
  key: CheckKey;
  state: CheckState;
}

export type EndpointKind = "thisApp" | "thisPathOtherHost" | "other";

export interface WebhookEndpointView {
  url: string;
  status: string;
  kind: EndpointKind;
  /** Whether it is subscribed to every event this app handles. */
  coversHandledEvents: boolean;
}

export interface StripeStatusView {
  secretKeyMode: KeyMode;
  publishableKeyMode: KeyMode;
  mockPayments: boolean;
  account:
    | {
        reachable: true;
        id: string;
        name: string | null;
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
        detailsSubmitted: boolean;
      }
    | { reachable: false; error: string };
  webhooks:
    | { reachable: true; endpoints: WebhookEndpointView[] }
    | { reachable: false; error: string };
  lastEvent: { at: Date; type: string; livemode: boolean } | null;
  payments: {
    realCount: number;
    firstRealAt: Date | null;
    lastRealAt: Date | null;
    mockCount: number;
  };
  checks: StripeCheck[];
}

const WEBHOOK_PATH = "/api/stripe/webhook";
/** Stripe is asked twice per page view; neither may hold the admin page up. */
const STRIPE_TIMEOUT_MS = 8_000;

async function requireSettingsAdmin(actorUserId: string) {
  const [isAdmin, isFinance] = await Promise.all([
    userHasRole(actorUserId, "admin"),
    userHasRole(actorUserId, "finance"),
  ]);
  if (!isAdmin && !isFinance) {
    throw new StripeStatusError("FORBIDDEN_NOT_ADMIN", 403);
  }
}

/** Which kind of key this is, from its prefix alone — the key never leaves. */
export function keyMode(key: string | undefined, kind: "secret" | "publishable"): KeyMode {
  const value = key?.trim();
  if (!value) return "missing";
  const prefixes = kind === "secret" ? ["sk_", "rk_"] : ["pk_"];
  for (const prefix of prefixes) {
    if (value.startsWith(`${prefix}live_`)) return "live";
    if (value.startsWith(`${prefix}test_`)) return "test";
  }
  return "unknown";
}

/** Every host this deployment answers on, as far as it knows them. */
export function appHosts(env: NodeJS.ProcessEnv = process.env): string[] {
  const hosts = new Set<string>();
  for (const raw of [env.NEXT_PUBLIC_APP_URL, env.BETTER_AUTH_URL]) {
    try {
      if (raw) hosts.add(new URL(raw).host);
    } catch {
      // Not a URL; nothing to learn from it.
    }
  }
  for (const host of [env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_URL]) {
    if (host) hosts.add(host.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
  }
  return [...hosts];
}

export function endpointKind(url: string, hosts: string[]): EndpointKind {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.replace(/\/$/, "") !== WEBHOOK_PATH) return "other";
    return hosts.includes(parsed.host) ? "thisApp" : "thisPathOtherHost";
  } catch {
    return "other";
  }
}

const covers = (enabled: string[]) =>
  enabled.includes("*") || HANDLED_STRIPE_EVENTS.every((e) => enabled.includes(e));

const reason = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

async function readAccount(): Promise<StripeStatusView["account"]> {
  try {
    const account = await stripe.accounts.retrieveCurrent({ timeout: STRIPE_TIMEOUT_MS });
    return {
      reachable: true,
      id: account.id,
      name:
        account.business_profile?.name ??
        account.settings?.dashboard?.display_name ??
        null,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    };
  } catch (error) {
    return { reachable: false, error: reason(error) };
  }
}

async function readWebhooks(): Promise<StripeStatusView["webhooks"]> {
  try {
    const list = await stripe.webhookEndpoints.list(
      { limit: 20 },
      { timeout: STRIPE_TIMEOUT_MS }
    );
    const hosts = appHosts();
    return {
      reachable: true,
      endpoints: list.data.map((endpoint) => ({
        url: endpoint.url,
        status: endpoint.status,
        kind: endpointKind(endpoint.url, hosts),
        coversHandledEvents: covers(endpoint.enabled_events),
      })),
    };
  } catch (error) {
    return { reachable: false, error: reason(error) };
  }
}

/** The checklist the admin reads top to bottom. */
export function checklist(view: Omit<StripeStatusView, "checks">): StripeCheck[] {
  const live = view.secretKeyMode === "live" && view.publishableKeyMode === "live";
  const endpoint =
    view.webhooks.reachable &&
    view.webhooks.endpoints.some(
      (e) => e.kind === "thisApp" && e.status === "enabled" && e.coversHandledEvents
    );
  const state = (ok: boolean, otherwise: CheckState = "todo"): CheckState =>
    ok ? "ok" : otherwise;

  return [
    { key: "liveKeys", state: state(live) },
    { key: "mockOff", state: state(!view.mockPayments, "fail") },
    {
      key: "chargesEnabled",
      state: view.account.reachable
        ? state(view.account.chargesEnabled)
        : "fail",
    },
    { key: "webhookEndpoint", state: view.webhooks.reachable ? state(endpoint) : "fail" },
    { key: "webhookReceived", state: state(view.lastEvent !== null) },
    { key: "firstRealPayment", state: state(view.payments.realCount > 0) },
  ];
}

async function readHeartbeat(): Promise<StripeStatusView["lastEvent"]> {
  const row = await stripeWebhookHeartbeatDal.get();
  return row
    ? { at: row.lastEventAt, type: row.lastEventType, livemode: row.lastEventLivemode }
    : null;
}

export const stripeStatusService = {
  async getForAdmin(actorUserId: string): Promise<StripeStatusView> {
    await requireSettingsAdmin(actorUserId);

    const [account, webhooks, lastEvent, payments] = await Promise.all([
      readAccount(),
      readWebhooks(),
      readHeartbeat(),
      paymentsDal.realChargeSummary(),
    ]);

    const view = {
      secretKeyMode: keyMode(process.env.STRIPE_SECRET_KEY, "secret"),
      publishableKeyMode: keyMode(
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
        "publishable"
      ),
      mockPayments: isMockPaymentsEnabled(),
      account,
      webhooks,
      lastEvent,
      payments: payments ?? { realCount: 0, firstRealAt: null, lastRealAt: null, mockCount: 0 },
    };

    return { ...view, checks: checklist(view) };
  },
};
