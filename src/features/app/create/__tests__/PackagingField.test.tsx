import { fireEvent, render, screen } from "@testing-library/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { NextIntlClientProvider } from "next-intl";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import en from "../../../../../messages/en.json";
import fr from "../../../../../messages/fr.json";
import { jobFormSchema, type JobFormValues } from "../schemas";
import { PackagingField } from "../ui/PackagingField";

/**
 * How the item already is, against what the carrier must do to it
 * (cargo_packaging_services_spec.md §3). The rows read alike, so what is
 * pinned here is that the field never lets them contradict each other.
 */
const onError = vi.fn();

function Harness({
  locale,
  messages,
}: {
  locale: string;
  messages: typeof en;
}) {
  // Created as `useJobForm` creates it, so the field gets the type it is
  // declared against without a cast.
  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: { needsProtection: false, needsPackaging: false },
  });

  return (
    <NextIntlClientProvider locale={locale} messages={messages} onError={onError}>
      <PackagingField form={form} />
    </NextIntlClientProvider>
  );
}

const renderField = (locale = "fr", messages = fr) =>
  render(<Harness locale={locale} messages={messages} />);

const row = (name: string) => screen.getByRole("switch", { name });
const toggle = (name: string) => fireEvent.click(row(name));
const isOn = (name: string) => row(name).getAttribute("aria-checked") === "true";

const ALREADY_PROTECTED = fr.create.what.packagingOptions.protected.label;
const ALREADY_BOXED = fr.create.what.packagingOptions.boxed.label;
const NEEDS_PROTECTION = fr.create.what.serviceOptions.needsProtection.label;
const NEEDS_PACKAGING = fr.create.what.serviceOptions.needsPackaging.label;

describe.each([
  ["fr", fr],
  ["en", en],
])("packaging field in %s", (locale, messages) => {
  it("resolves every label", () => {
    const { container } = renderField(locale, messages as typeof en);

    expect(container.textContent).not.toContain("create.what");
    expect(onError).not.toHaveBeenCalled();
  });

  it("offers two states and two services, all off", () => {
    renderField(locale, messages as typeof en);

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(4);
    for (const s of switches) expect(s).toHaveAttribute("aria-checked", "false");
  });
});

describe("packaging field coherence", () => {
  it("asks for both services at once", () => {
    renderField();

    toggle(NEEDS_PROTECTION);
    toggle(NEEDS_PACKAGING);

    expect(isOn(NEEDS_PROTECTION)).toBe(true);
    expect(isOn(NEEDS_PACKAGING)).toBe(true);
  });

  it("drops both services when the item turns out to be boxed already", () => {
    renderField();

    toggle(NEEDS_PROTECTION);
    toggle(NEEDS_PACKAGING);
    toggle(ALREADY_BOXED);

    expect(isOn(ALREADY_BOXED)).toBe(true);
    expect(isOn(NEEDS_PROTECTION)).toBe(false);
    expect(isOn(NEEDS_PACKAGING)).toBe(false);
  });

  it("drops the state when a service it already covers is asked for", () => {
    renderField();

    toggle(ALREADY_PROTECTED);
    toggle(NEEDS_PROTECTION);

    expect(isOn(NEEDS_PROTECTION)).toBe(true);
    expect(isOn(ALREADY_PROTECTED)).toBe(false);
  });

  it("lets a wrapped item still ask for a box", () => {
    renderField();

    toggle(ALREADY_PROTECTED);
    toggle(NEEDS_PACKAGING);

    expect(isOn(ALREADY_PROTECTED)).toBe(true);
    expect(isOn(NEEDS_PACKAGING)).toBe(true);
  });

  it("keeps the two states exclusive", () => {
    renderField();

    toggle(ALREADY_PROTECTED);
    toggle(ALREADY_BOXED);

    expect(isOn(ALREADY_BOXED)).toBe(true);
    expect(isOn(ALREADY_PROTECTED)).toBe(false);
  });
});
