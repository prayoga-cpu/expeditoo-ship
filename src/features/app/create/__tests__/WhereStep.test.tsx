import { useState, type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import fr from "../../../../../messages/fr.json";

/**
 * An apartment's floor on the Where step, rendered by the real `JobForm` over
 * the real `useJobForm` (numeric_input_spec.md §6). The map, the network, the
 * router and the toasts are stood in for, as in `BudgetStep.test.tsx`.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
// The location picker is a map loaded on demand; the floor sits beside it.
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
// The requester's address book, set per test (saved_addresses_spec.md §3).
const book = vi.hoisted(() => ({ addresses: [] as unknown[] }));
vi.mock("@/features/app/profile/api/addresses.api", () => ({
  createAddress: vi.fn(),
  fetchAddresses: vi.fn(async () => book.addresses),
}));
// The real module otherwise: a resumed draft is rebuilt through its
// `splitFragileNote`.
vi.mock("../api/jobs.api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/jobs.api")>()),
  jobsApi: { create: vi.fn(), saveDraft: vi.fn() },
}));

import { useJobForm, type JobFormApi, type JobFormSeed } from "../hooks/useJobForm";
import { JobForm } from "../ui/JobForm";

let api: JobFormApi;

/** The form as the page builds it, opened on « Où ». */
function WherePage() {
  api = useJobForm();
  return (
    <JobForm {...api} currentStep={1} isFirstStep={false} isLastStep={false} />
  );
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="fr" messages={fr} timeZone="Europe/Paris">
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

const setValue = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  "value"
)?.set;

/**
 * An edit as a browser makes it: the text changed past React's record of it,
 * the caret where the browser leaves it, then `input`.
 */
function browserEdit(input: HTMLInputElement, text: string, caret: number) {
  setValue?.call(input, text);
  input.setSelectionRange(caret, caret);
  fireEvent.input(input);
}

/** A key typed wherever the box left its caret, as a person types it. */
function typeAtCaret(input: HTMLInputElement, key: string) {
  const at = input.selectionStart ?? input.value.length;
  fireEvent.keyDown(input, { key });
  browserEdit(input, input.value.slice(0, at) + key + input.value.slice(at), at + 1);
  fireEvent.keyUp(input, { key });
}

/** The pickup made an apartment, its floor box typed « 100 ». */
function floorOf100() {
  render(<WherePage />, { wrapper });
  act(() => api.form.setValue("pickup.locationType", "apartment"));
  const floor = screen.getByLabelText(fr.create.where.floor, {
    exact: false,
  }) as HTMLInputElement;
  for (const key of "100") typeAtCaret(floor, key);
  expect(floor.value).toBe("100");
  expect(api.form.getValues("pickup.floor")).toBe(100);
  return floor;
}

/** Delete with the caret in front of the « 1 ». */
function deleteTheOne(floor: HTMLInputElement) {
  floor.setSelectionRange(0, 0);
  fireEvent.keyDown(floor, { key: "Delete" });
  browserEdit(floor, "00", 0);
  fireEvent.keyUp(floor, { key: "Delete" });
}

describe("the floor box", () => {
  // Found in review: re-derived from the floor, « 00 » was rewritten to « 0 »
  // with the caret thrown to the end, and the « 2 » gave floor 2.
  it("gives 200 when the « 1 » of « 100 » is replaced by a « 2 »", () => {
    const floor = floorOf100();

    deleteTheOne(floor);
    expect(floor.value).toBe("00");
    expect(floor.selectionStart).toBe(0);
    expect(api.form.getValues("pickup.floor")).toBe(0);

    typeAtCaret(floor, "2");
    expect(floor.value).toBe("200");
    expect(api.form.getValues("pickup.floor")).toBe(200);
  });

  it("reads « 0 » once left with its « 1 » deleted, floor 0", () => {
    const floor = floorOf100();

    deleteTheOne(floor);
    fireEvent.blur(floor);

    expect(floor.value).toBe("0");
    expect(api.form.getValues("pickup.floor")).toBe(0);
  });

  it("shows a floor changed from outside while the box is shown", () => {
    const floor = floorOf100();

    act(() => api.form.setValue("pickup.floor", 3));

    expect(floor.value).toBe("3");
  });
});

// The box keeps its own text, filled when it mounts — and every real way a
// floor reaches it is a mount: a resumed draft, « Retour » to « Où » (the
// step unmounts on every change).
let setStep: (step: number) => void;

/** The form with its step driven as « Suivant » and « Retour » drive it. */
function SteppedPage({ seed }: { seed?: JobFormSeed }) {
  api = useJobForm(seed);
  const [step, set] = useState(api.currentStep);
  setStep = set;
  return <JobForm {...api} currentStep={step} isFirstStep={false} isLastStep={false} />;
}

const tomorrow = new Date(Date.now() + 24 * 3600_000);
tomorrow.setHours(9, 0, 0, 0);
const at = (ms: number) => new Date(tomorrow.getTime() + ms).toISOString();
const HOUR = 3600_000;

/** A saved apartment-to-apartment request, its times on the half-hour list. */
const savedWithFloors = (pickupFloor: number | null, dropoffFloor: number | null) =>
  ({
    id: "draft-7",
    reference: 100042,
    shipperId: "requester-1",
    status: "draft",
    title: "Canapé deux places",
    description: "Un canapé, démonté.",
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
    pickupLocationType: "apartment",
    pickupLat: null,
    pickupLng: null,
    pickupFloor,
    pickupHasLift: true,
    pickupNote: null,
    pickupContactName: null,
    pickupContactPhone: "+33612345678",
    dropoffAddress: "3 rue Paradis",
    dropoffCity: "Marseille",
    dropoffPostalCode: "13001",
    dropoffLocationType: "apartment",
    dropoffLat: null,
    dropoffLng: null,
    dropoffFloor,
    dropoffHasLift: false,
    dropoffNote: null,
    dropoffContactName: null,
    dropoffContactPhone: "+33698765432",
    pickupFrom: at(0),
    pickupUntil: at(HOUR),
    dropoffFrom: at(24 * HOUR),
    dropoffUntil: at(25 * HOUR),
    isFlexible: false,
    budgetCents: 4_000,
    acceptedOfferId: null,
    origin: "direct",
    offersCount: 0,
    views: 0,
    expiresAt: at(0),
    reopenedAt: null,
    scheduledPublishAt: null,
    createdAt: at(-HOUR),
    updatedAt: at(-HOUR),
    photos: [],
  }) as never;

const floorBox = (side: "pickup" | "dropoff") =>
  document.getElementById(`${side}-floor`) as HTMLInputElement | null;

describe("the floor box, mounted over a floor already in the form", () => {
  it("shows a resumed draft's floors, the ground floor included", () => {
    render(<SteppedPage seed={{ draft: savedWithFloors(3, 0), startStep: 1 }} />, { wrapper });

    expect(floorBox("pickup")?.value).toBe("3");
    expect(floorBox("dropoff")?.value).toBe("0");
  });

  it("keeps a typed floor through « Suivant » and « Retour »", () => {
    render(<SteppedPage seed={{ startStep: 1 }} />, { wrapper });
    act(() => api.form.setValue("pickup.locationType", "apartment"));
    typeAtCaret(floorBox("pickup")!, "3");

    act(() => setStep(2));
    expect(floorBox("pickup")).toBeNull();
    act(() => setStep(1));

    expect(floorBox("pickup")?.value).toBe("3");
    expect(api.form.getValues("pickup.floor")).toBe(3);
  });
});

describe("the saved addresses on « Où » (saved_addresses_spec.md §3)", () => {
  const saved = (id: string, label: string, street: string, over = {}) => ({
    id,
    label,
    street,
    city: "Saleux",
    zip: "80480",
    country: "France",
    isDefault: false,
    lat: 49.86 + street.length / 1000,
    lng: 2.24,
    usedFor: null,
    ...over,
  });
  // The owner's screenshot: « work » the newest, « home » before it — and
  // both names stored as the translation key's path.
  const work = saved("a-work", "profile.address.labelPresets.work", "Autoroute des Anglais");
  const home = saved("a-home", "profile.address.labelPresets.home", "Voie du Loup");

  const trigger = (side: "pickup" | "dropoff") =>
    document.getElementById(`${side}-saved-address`) as HTMLElement;

  beforeEach(() => {
    book.addresses = [];
    window.HTMLElement.prototype.hasPointerCapture ??= () => false;
    window.HTMLElement.prototype.setPointerCapture ??= () => {};
    window.HTMLElement.prototype.releasePointerCapture ??= () => {};
    window.HTMLElement.prototype.scrollIntoView ??= () => {};
  });

  it("fills the pickup only, and opens the delivery on a new address", async () => {
    book.addresses = [work, home];
    render(<SteppedPage seed={{ startStep: 1 }} />, { wrapper });

    await waitFor(() =>
      expect(api.form.getValues("pickup.address")).toBe("Autoroute des Anglais")
    );
    expect(api.form.getValues("dropoff.address")).toBe("");
    expect(trigger("dropoff")).toHaveTextContent(fr.create.where.useNewAddress);
    // The new-address fields are open at the delivery, not at the pickup.
    expect(document.getElementById("dropoff-save-address")).not.toBeNull();
    expect(document.getElementById("pickup-save-address")).toBeNull();
  });

  it("names a saved address, never by its translation key", async () => {
    book.addresses = [work, home];
    render(<SteppedPage seed={{ startStep: 1 }} />, { wrapper });

    await waitFor(() => expect(trigger("pickup")).toHaveTextContent("Travail"));
    expect(document.body).not.toHaveTextContent("profile.address");
  });

  it("says the delivery is the pickup's address the moment it is chosen", async () => {
    book.addresses = [home];
    render(<SteppedPage seed={{ startStep: 1 }} />, { wrapper });
    await waitFor(() =>
      expect(api.form.getValues("pickup.address")).toBe("Voie du Loup")
    );
    expect(screen.queryByText(fr.create.validation.sameAddress)).toBeNull();

    // Radix answers a letter on a closed select by picking the option it
    // starts — « Domicile », the pickup's address.
    fireEvent.keyDown(trigger("dropoff"), { key: "D" });

    expect(api.form.getValues("dropoff.address")).toBe("Voie du Loup");
    expect(screen.getByText(fr.create.validation.sameAddress)).toBeInTheDocument();
  });

  it("leaves a resumed request's addresses as they were saved", async () => {
    book.addresses = [home];
    render(<SteppedPage seed={{ draft: savedWithFloors(1, 1), startStep: 1 }} />, {
      wrapper,
    });

    await waitFor(() => expect(trigger("pickup")).not.toBeNull());
    expect(api.form.getValues("pickup.address")).toBe("12 rue de la République");
    expect(api.form.getValues("dropoff.address")).toBe("3 rue Paradis");
  });
});
