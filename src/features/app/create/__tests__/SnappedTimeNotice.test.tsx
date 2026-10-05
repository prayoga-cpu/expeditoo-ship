import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider, createTranslator, type Messages } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import type { DraftJob } from "@/features/app/listing/types";
import fr from "../../../../../messages/fr.json";

/**
 * A request saved at a time the half-hour list does not offer, resumed to be
 * published (draft_requests_spec.md §2): it opens on « Quand », whatever step
 * was asked for, and says which time was saved and which is selected. The real
 * `JobForm` over the real `useJobForm`; the network, the router and the
 * toasts are stood in for, as in `BudgetStep.test.tsx`.
 */

/** Catalogue text by its path, resolved as the page resolves it. */
const tr = createTranslator({
  locale: "fr",
  messages: fr as Messages,
  onError: () => {},
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/features/app/profile/api/addresses.api", () => ({
  createAddress: vi.fn(),
  fetchAddresses: vi.fn(),
}));
vi.mock("../api/jobs.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/jobs.api")>()),
  jobsApi: { create: vi.fn(), saveDraft: vi.fn() },
}));

import { useJobForm } from "../hooks/useJobForm";
import { JobForm } from "../ui/JobForm";

// 2030-01-07 09:15 and 2030-01-09 14:30, local: the first is off the list.
const at = (day: number, hour: number, minute: number) => new Date(2030, 0, day, hour, minute);

const SAVED = {
  id: "draft-7",
  reference: 100077,
  shipperId: "requester-1",
  status: "draft",
  title: "Canapé deux places",
  description: "Un canapé, rez-de-chaussée des deux côtés.",
  weightKg: 100,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  quantity: 1,
  isFragile: false,
  needsHelp: false,
  packagingLevel: null,
  needsProtection: false,
  needsPackaging: false,
  pickupAddress: "12 rue de la République",
  pickupCity: "Lyon",
  pickupPostalCode: "69002",
  pickupLocationType: "house",
  pickupLat: null,
  pickupLng: null,
  pickupFloor: null,
  pickupHasLift: null,
  pickupNote: null,
  pickupContactName: null,
  pickupContactPhone: "+33612345678",
  dropoffAddress: "3 rue Paradis",
  dropoffCity: "Marseille",
  dropoffPostalCode: "13001",
  dropoffLocationType: "house",
  dropoffLat: null,
  dropoffLng: null,
  dropoffFloor: null,
  dropoffHasLift: null,
  dropoffNote: null,
  dropoffContactName: null,
  dropoffContactPhone: "+33698765432",
  pickupFrom: at(7, 9, 15).toISOString(),
  pickupUntil: at(7, 10, 15).toISOString(),
  dropoffFrom: at(9, 14, 30).toISOString(),
  dropoffUntil: at(9, 15, 30).toISOString(),
  isFlexible: false,
  budgetCents: 4_000,
  acceptedOfferId: null,
  origin: "direct",
  offersCount: 0,
  views: 0,
  expiresAt: at(7, 3, 15).toISOString(),
  reopenedAt: null,
  scheduledPublishAt: null,
  createdAt: at(1, 12, 0).toISOString(),
  updatedAt: at(1, 12, 0).toISOString(),
  photos: [],
} as DraftJob;

/** The form as `DraftForm` builds it, for « Publier »: asked to open on Budget. */
function PublishPage({ draft }: { draft: DraftJob }) {
  return <JobForm {...useJobForm({ draft, startStep: 3 })} />;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe("a resumed request whose saved time had to move", () => {
  it("opens on « Quand » and names the time saved and the time selected", () => {
    render(<PublishPage draft={SAVED} />, { wrapper });

    expect(
      screen.getByText(tr("create.resume.snappedTime.pickup", { saved: "09:15", selected: "09:30" }))
    ).toBeInTheDocument();
    expect(screen.getByText(fr.create.when.hourLabel, { selector: "label[for='pickup-hour']" })).toBeInTheDocument();
    expect(screen.queryByLabelText(fr.create.budget.label, { exact: false })).toBeNull();
  });

  it("says nothing, and opens where it was asked, when every time is on the list", () => {
    const onTheList = {
      ...SAVED,
      pickupFrom: at(7, 9, 30).toISOString(),
      pickupUntil: at(7, 10, 30).toISOString(),
    };
    render(<PublishPage draft={onTheList} />, { wrapper });

    expect(screen.getByLabelText(fr.create.budget.label, { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/09:15/)).toBeNull();
  });
});
