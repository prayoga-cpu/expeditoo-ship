/**
 * Re-takes the home page's « Dans l'application » screenshots
 * (docs/specs/landing_app_tour_spec.md §4).
 *
 *   node scripts/capture-app-tour.mjs            # all steps, fr + en
 *   STEPS=choose,track node scripts/capture-app-tour.mjs
 *
 * Needs the app running against a database seeded by `pnpm db:seed:demo`
 * (never a real one: these pictures are published), with TZ=Europe/Paris:
 *
 *   TZ=Europe/Paris POSTGRES_URL=postgresql://postgres@localhost:5432/expeditop_demo \
 *     NEXT_PUBLIC_APP_URL=http://localhost:3007 MOCK_PAYMENTS=true npx next dev -p 3007
 *
 * It signs in to the demo accounts, finds each record by what it is (the open
 * request with the most offers, the run in transit…) rather than by id, and
 * writes public/images/landing/app/<step>-<desktop|phone>-<fr|en>.webp.
 */
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const BASE = process.env.TOUR_BASE_URL ?? "http://localhost:3007";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo-expeditop-2026";
const OUT = new URL("../public/images/landing/app/", import.meta.url).pathname;
const ONLY = process.env.STEPS ? process.env.STEPS.split(",") : null;
const LOCALES = process.env.LOCALES ? process.env.LOCALES.split(",") : ["fr", "en"];

const ACCOUNTS = {
  requester: "camille@demo.expeditop.test",
  carrier: "julien@demo.expeditop.test",
  staff: "admin@demo.expeditop.test",
};

const DEVICES = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, out: { width: 1280, height: 800 } },
  phone: { viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, out: { width: 780, height: 1560 } },
};

/** Each step: who looks, and where. `path` may be worked out from the API. */
const STEPS = [
  { key: "request", who: "requester", path: async () => "/create" },
  { key: "board", who: "carrier", path: async () => "/expedion" },
  { key: "choose", who: "requester", path: async (api) => `/listing/${await busiestOpenRequest(api)}`, scrollTo: (page) => page.getByRole("heading", { name: /^(Offres|Offers)\b/ }) },
  { key: "messages", who: "requester", path: async (api) => `/messages/${await threadOfRunInTransit(api)}` },
  { key: "run", who: "carrier", path: async (api) => `/driver/shipments/${await runInStatus(api, "IN_TRANSIT")}` },
  { key: "track", who: "requester", path: async (api) => `/deliveries/${await runInStatus(api, "IN_TRANSIT")}` },
  { key: "money", who: "carrier", path: async () => "/carrier/withdrawals" },
  { key: "team", who: "staff", path: async () => "/admin/drivers" },
];

async function json(api, url) {
  const response = await api.get(BASE + url);
  if (!response.ok()) throw new Error(`${url} answered ${response.status()}`);
  const body = await response.json();
  return body.data ?? body;
}

function rows(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ["items", "listings", "shipments", "conversations", "messages", "data"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  throw new Error("no list in the answer");
}

async function busiestOpenRequest(api) {
  const mine = rows(await json(api, "/api/listings/me?limit=50"));
  const open = mine.filter((listing) => listing.status === "open");
  open.sort((a, b) => (b.offersCount ?? 0) - (a.offersCount ?? 0));
  if (!open[0]) throw new Error("the requester has no open request");
  return open[0].id;
}

/** The conversation about the run in transit: the one with an accepted price in it. */
async function threadOfRunInTransit(api) {
  const runs = rows(await json(api, "/api/shipments?limit=50"));
  const run = runs.find((shipment) => shipment.status === "IN_TRANSIT");
  const threads = rows(await json(api, "/api/messages/conversations"));
  const thread = threads.find((item) => run && item.listing?.id === run.listingId) ?? threads[0];
  if (!thread) throw new Error("no conversation");
  return thread.id;
}

async function runInStatus(api, status) {
  const runs = rows(await json(api, "/api/shipments?limit=50"));
  const run = runs.find((shipment) => shipment.status === status);
  if (!run) throw new Error(`no run in ${status}`);
  return run.id;
}

async function signedIn(browser, email, locale, device) {
  const { out: _out, ...options } = DEVICES[device];
  const context = await browser.newContext({
    ...options,
    locale: locale === "fr" ? "fr-FR" : "en-GB",
    timezoneId: "Europe/Paris",
    reducedMotion: "reduce",
  });
  await context.addInitScript((lang) => {
    try {
      localStorage.setItem("expeditoo-locale", lang);
      localStorage.setItem("theme", "light");
    } catch {}
  }, locale);
  const page = await context.newPage();
  const response = await page.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email, password: PASSWORD },
    headers: { origin: BASE },
  });
  if (!response.ok()) throw new Error(`sign-in as ${email} answered ${response.status()}`);
  return { context, page };
}

async function shoot(page, path, file, size, scrollTo) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  // The dev-mode indicator, the version tag and the install prompt are not the app.
  await page.addStyleTag({ content: "nextjs-portal, pwa-install { display: none !important; }" });
  await page.waitForTimeout(1500);
  if (scrollTo) {
    // The app scrolls inside <main>; bring the part the step is about under the header.
    await scrollTo(page).first().evaluate((node) => node.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(600);
  }
  const png = await page.screenshot({ type: "png" });
  await sharp(png).resize(size.width, size.height, { fit: "cover", position: "top" }).webp({ quality: 78 }).toFile(file);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
let failed = 0;
for (const locale of LOCALES) {
  for (const device of Object.keys(DEVICES)) {
    const sessions = {};
    for (const step of STEPS) {
      if (ONLY && !ONLY.includes(step.key)) continue;
      try {
        sessions[step.who] ??= await signedIn(browser, ACCOUNTS[step.who], locale, device);
        const { page } = sessions[step.who];
        const path = await step.path(page.request);
        const file = `${OUT}${step.key}-${device}-${locale}.webp`;
        await shoot(page, path, file, DEVICES[device].out, step.scrollTo);
        console.log("ok", `${step.key}-${device}-${locale}`, path);
      } catch (error) {
        failed += 1;
        console.log("FAILED", step.key, device, locale, String(error).slice(0, 160));
      }
    }
    for (const session of Object.values(sessions)) await session.context.close();
  }
}
await browser.close();
process.exit(failed ? 1 : 0);
