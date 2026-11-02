import { fireEvent, render, screen } from "@testing-library/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { NextIntlClientProvider } from "next-intl";
import { useForm, type UseFormGetValues } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";
import type { JobKind } from "@/lib/moving";
import { jobFormSchema, type JobFormValues } from "../schemas";
import { JobKindLink, MovingFields } from "../ui/MovingFields";

// The dropzone uploads; nothing here is about photos.
vi.mock("../ui/PhotoDropzone", () => ({ PhotoDropzone: () => null }));

/**
 * client_feedback_2026_10_31_spec.md §2.2 — « Vous déménagez ? Cliquez plutôt
 * ici ! » and the move's own step.
 */
const onError = vi.fn();
let getValues: UseFormGetValues<JobFormValues>;

function Harness({ locale, messages }: { locale: string; messages: typeof en }) {
  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: { jobKind: "moving", movingSizeMode: "surface", needsProtection: false, needsPackaging: false },
  });
  getValues = form.getValues;
  return (
    <NextIntlClientProvider locale={locale} messages={messages} onError={onError}>
      <MovingFields form={form} photos={[]} onPhotosChange={() => {}} />
    </NextIntlClientProvider>
  );
}

describe.each([
  ["fr", fr],
  ["en", en],
])("the move's step in %s", (locale, messages) => {
  it("resolves every label", () => {
    const { container } = render(<Harness locale={locale} messages={messages as typeof en} />);

    expect(container.textContent).not.toMatch(/create\.(moving|what)/);
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("the move's step", () => {
  it("asks the surface, then the volume once « Je connais le volume exact » is on", () => {
    render(<Harness locale="fr" messages={fr as unknown as typeof en} />);

    expect(screen.getByLabelText(fr.create.moving.surface, { exact: false })).toBeTruthy();
    expect(screen.queryByLabelText(fr.create.moving.volume, { exact: false })).toBeNull();

    fireEvent.click(screen.getByRole("switch", { name: fr.create.moving.exactVolume }));

    expect(getValues("movingSizeMode")).toBe("volume");
    expect(screen.getByLabelText(fr.create.moving.volume, { exact: false })).toBeTruthy();
  });

  it("asks nothing about items", () => {
    render(<Harness locale="fr" messages={fr as unknown as typeof en} />);

    expect(screen.queryByText(fr.create.what.fragile)).toBeNull();
    expect(screen.getByText(fr.create.moving.publicNote)).toBeTruthy();
  });
});

describe("JobKindLink", () => {
  const renderLink = (kind: JobKind, onChange = vi.fn()) => {
    render(
      <NextIntlClientProvider locale="fr" messages={fr} onError={onError}>
        <JobKindLink kind={kind} onChange={onChange} />
      </NextIntlClientProvider>
    );
    return onChange;
  };

  it("offers the move from items, in the client's words", () => {
    const onChange = renderLink("items");

    expect(screen.getByText("Vous déménagez ?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Cliquez plutôt ici/ }));
    expect(onChange).toHaveBeenCalledWith("moving");
  });

  it("offers the way back from a move", () => {
    const onChange = renderLink("moving");

    fireEvent.click(screen.getByRole("button", { name: /Revenir au formulaire objets/ }));
    expect(onChange).toHaveBeenCalledWith("items");
  });
});
