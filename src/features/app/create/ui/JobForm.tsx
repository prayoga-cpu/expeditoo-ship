"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper } from "@/components/Stepper";
import { InlineLoader } from "@/components/ui/page-loader";
import { PhotoDropzone } from "./PhotoDropzone";
import { FieldError } from "./FieldError";
import { SizeField } from "./SizeField";
import { ItemField } from "./ItemField";
import { WeightBracketField } from "./WeightBracketField";
import { TimingField } from "./TimingField";
import { PublishTimingField } from "./PublishTimingField";
import { SavedAddressPicker } from "./SavedAddressPicker";
import { LOCATION_TYPES, type LocationType } from "../schemas";
import { useAddressBook, type Address } from "../hooks/useAddressBook";
import type { JobFormApi } from "../hooks/useJobForm";

// `maplibre-gl` + `react-map-gl` are only needed once someone reaches the
// "Where" step, but a static import puts them in the same chunk as "What" —
// every /create visit paid for the map before picking a single address.
// Split the same way `LazyAblyProvider` already splits Ably.
const LocationPickerField = dynamic(
  () =>
    import("@/components/ui/location-picker-field").then(
      (mod) => mod.LocationPickerField
    ),
  { ssr: false, loading: () => <InlineLoader size="md" className="h-64" /> }
);

/**
 * Requesting transport: what moves, from where to where, when, and what the
 * requester expects to pay. Four steps, each validated on its own so nobody is
 * blocked by a field on a screen they have not reached yet.
 *
 * Carriers bid; the requester picks the offer. That is why the last step asks
 * for an expectation rather than a price — see `BudgetStep`.
 */
export function JobForm(props: JobFormApi) {
  const t = useTranslations("create");
  const {
    form,
    photos,
    timing,
    handleTimingChange,
    currentStep,
    steps,
    isFirstStep,
    isLastStep,
    isSubmitting,
    handlePhotosChange,
    handleNext,
    handlePrev,
    publish,
    saveDraft,
  } = props;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6 xl:max-w-3xl 2xl:max-w-4xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <Stepper
        steps={steps.map((step) => t(`steps.${step}`))}
        currentStep={currentStep}
      />

      <Card className="p-4 sm:p-6">
        {currentStep === 0 && (
          <WhatStep
            form={form}
            photos={photos}
            onPhotosChange={handlePhotosChange}
          />
        )}
        {currentStep === 1 && <WhereStep form={form} />}
        {currentStep === 2 && (
          <WhenStep
            form={form}
            timing={timing}
            onTimingChange={handleTimingChange}
          />
        )}
        {currentStep === 3 && <BudgetStep form={form} />}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={handlePrev}
          disabled={isFirstStep || isSubmitting}
        >
          {t("buttons.back")}
        </Button>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={saveDraft}
            disabled={isSubmitting}
          >
            {t("buttons.saveDraft")}
          </Button>
          {isLastStep ? (
            <Button type="button" onClick={publish} disabled={isSubmitting}>
              {isSubmitting
                ? t("buttons.posting")
                : form.watch("publishMode") === "schedule"
                  ? t("buttons.schedule")
                  : t("buttons.post")}
            </Button>
          ) : (
            <Button type="button" onClick={handleNext} disabled={isSubmitting}>
              {t("buttons.next")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * `JobFormApi` is taken from the hook rather than written as
 * `UseFormReturn<JobFormValues>`: a resolver adds a third generic for the
 * transformed output, so the spelled-out version is a different type from the
 * one `useJobForm` actually returns.
 */
interface StepProps {
  form: JobFormApi["form"];
}

function WhatStep({
  form,
  photos,
  onPhotosChange,
}: StepProps & { photos: string[]; onPhotosChange: (p: string[]) => void }) {
  const t = useTranslations("create.what");
  const { register, formState, setValue, watch } = form;
  const errors = formState.errors;

  return (
    <div className="space-y-5">
      <ItemField form={form} />

      <div>
        <Label htmlFor="description" required>
          {t("descriptionLabel")}
        </Label>
        <Textarea
          id="description"
          rows={4}
          placeholder={t("descriptionPlaceholder")}
          {...register("description")}
        />
        <FieldError message={errors.description?.message} />
      </div>

      <WeightBracketField form={form} />

      <SizeField form={form} />

      <div className="space-y-3">
        <ToggleRow
          id="isFragile"
          label={t("fragile")}
          description={t("fragileHint")}
          checked={Boolean(watch("isFragile"))}
          onChange={(v) => setValue("isFragile", v)}
        />
        {watch("isFragile") && (
          <div className="pl-3">
            <Label htmlFor="fragileNote">{t("fragileNoteLabel")}</Label>
            <Input
              id="fragileNote"
              placeholder={t("fragileNotePlaceholder")}
              {...register("fragileNote")}
            />
            <FieldError message={errors.fragileNote?.message} />
          </div>
        )}
        <ToggleRow
          id="needsHelp"
          label={t("help")}
          description={t("helpHint")}
          checked={Boolean(watch("needsHelp"))}
          onChange={(v) => setValue("needsHelp", v)}
        />
      </div>

      {/* A top-level field group like WeightBracketField/SizeField above it,
          not folded into the toggle-row cluster — it has its own label and a
          two-card choice, not a compact switch row, so it wants the step's
          own space-y-5 rhythm on both sides rather than the tighter
          space-y-3 the toggles use between each other. */}
      <div className="space-y-2">
        <Label>{t("packaging")}</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={watch("packagingLevel") ?? ""}
          onValueChange={(value) =>
            setValue(
              "packagingLevel",
              (value || undefined) as "protected" | "boxed" | undefined
            )
          }
          className="w-full"
        >
          <ToggleGroupItem value="protected" className="flex-1 flex-col gap-0.5 py-2 whitespace-normal">
            <span className="text-sm font-medium">
              {t("packagingOptions.protected.label")}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {t("packagingOptions.protected.description")}
            </span>
          </ToggleGroupItem>
          <ToggleGroupItem value="boxed" className="flex-1 flex-col gap-0.5 py-2 whitespace-normal">
            <span className="text-sm font-medium">
              {t("packagingOptions.boxed.label")}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {t("packagingOptions.boxed.description")}
            </span>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div>
        <Label>{t("photos")}</Label>
        <p className="mb-2 mt-1 text-xs text-muted-foreground">
          {t("photosHint")}
        </p>
        <PhotoDropzone photos={photos} onPhotosChange={onPhotosChange} />
      </div>
    </div>
  );
}

function WhereStep({ form }: StepProps) {
  const t = useTranslations("create.where");
  return (
    <div className="space-y-8">
      <EndpointFields form={form} side="pickup" title={t("pickup")} />
      <EndpointFields form={form} side="dropoff" title={t("dropoff")} />
    </div>
  );
}

function EndpointFields({
  form,
  side,
  title,
}: StepProps & { side: "pickup" | "dropoff"; title: string }) {
  const t = useTranslations("create.where");
  const tTypes = useTranslations("create.locationTypes");
  const { setValue, watch, formState } = form;
  const endpoint = watch(side);
  const error = formState.errors[side];
  const locationType = endpoint?.locationType;

  const { data: savedAddresses = [] } = useAddressBook();
  // A job needs a pin to route and price; the profile lets an address be
  // saved without one, so only a geocoded saved address is selectable here.
  const pinnedAddresses = useMemo(
    () => savedAddresses.filter((a) => a.lat != null && a.lng != null),
    [savedAddresses]
  );

  const applySavedAddress = useCallback(
    (address: Address) => {
      setValue(`${side}.address`, address.street, { shouldValidate: true });
      setValue(`${side}.city`, address.city);
      setValue(`${side}.postalCode`, address.zip);
      setValue(`${side}.lat`, address.lat as number);
      setValue(`${side}.lng`, address.lng as number);
      setValue(`${side}.saveAddress`, false);
      setValue(`${side}.addressLabel`, "");
    },
    [setValue, side]
  );

  const switchToNewAddress = useCallback(() => {
    setValue(`${side}.address`, "");
    setValue(`${side}.city`, "");
    setValue(`${side}.postalCode`, "");
    // Not `blankToUndefined`-backed like `floor` — `lat`/`lng` are required
    // numbers in the schema, so clearing them for a fresh custom entry is a
    // deliberate cast, the same way `packagingLevel`'s clear-to-empty above
    // casts through the union rather than the schema's own optional type.
    setValue(`${side}.lat`, undefined as unknown as number);
    setValue(`${side}.lng`, undefined as unknown as number);
  }, [setValue, side]);

  // Pre-fill the default saved address the first time the list loads, on a
  // fresh endpoint only — never overwrites an address already entered,
  // whether that came from the map or from restoring a draft.
  useEffect(() => {
    if (pinnedAddresses.length === 0) return;
    if (form.getValues(`${side}.address`)) return;
    applySavedAddress(
      pinnedAddresses.find((a) => a.isDefault) ?? pinnedAddresses[0]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedAddresses.length]);

  const selectedAddressId =
    pinnedAddresses.find(
      (a) =>
        a.street === endpoint?.address &&
        a.zip === endpoint?.postalCode &&
        a.lat === endpoint?.lat &&
        a.lng === endpoint?.lng
    )?.id ?? "custom";
  const usingSavedAddress = selectedAddressId !== "custom";

  return (
    <section className="space-y-4">
      <h2 className="font-semibold">{title}</h2>

      {pinnedAddresses.length > 0 && (
        <SavedAddressPicker
          addresses={pinnedAddresses}
          selectedId={selectedAddressId}
          onSelect={(address) =>
            address ? applySavedAddress(address) : switchToNewAddress()
          }
        />
      )}

      {!usingSavedAddress && (
        <>
          {/* The shared picker rather than a private map: it already searches
              Nominatim, drags a pin, reverse-geocodes and refuses anywhere
              outside France, in both languages and both themes. */}
          <LocationPickerField
            id={`${side}-location`}
            allowManualOnly
            value={{
              address: endpoint?.address ?? "",
              city: endpoint?.city ?? "",
              postalCode: endpoint?.postalCode ?? "",
              lat: endpoint?.lat ?? null,
              lng: endpoint?.lng ?? null,
            }}
            onChange={(next) => {
              setValue(`${side}.address`, next.address, {
                shouldValidate: true,
              });
              setValue(`${side}.city`, next.city);
              setValue(`${side}.postalCode`, next.postalCode);
              // `null` is a real answer here — switching to manual mode (or
              // back to the map for a fresh pin) clears whatever coordinates
              // were there, and the schema now accepts an endpoint with none.
              setValue(`${side}.lat`, next.lat ?? undefined, {
                shouldValidate: true,
              });
              setValue(`${side}.lng`, next.lng ?? undefined, {
                shouldValidate: true,
              });
            }}
          />
          <FieldError message={error?.address?.message} />
          <FieldError message={error?.city?.message} />
          <FieldError message={error?.postalCode?.message} />

          <div className="flex items-center gap-2">
            <Checkbox
              id={`${side}-save-address`}
              checked={Boolean(endpoint?.saveAddress)}
              onCheckedChange={(checked) =>
                setValue(`${side}.saveAddress`, checked === true)
              }
            />
            <Label
              htmlFor={`${side}-save-address`}
              className="cursor-pointer font-normal"
            >
              {t("saveAddress")}
            </Label>
          </div>
          {endpoint?.saveAddress && (
            <div>
              <Label htmlFor={`${side}-address-label`}>
                {t("addressLabelField")}
              </Label>
              <Input
                id={`${side}-address-label`}
                placeholder={t("addressLabelPlaceholder")}
                value={endpoint?.addressLabel ?? ""}
                onChange={(e) =>
                  setValue(`${side}.addressLabel`, e.target.value)
                }
              />
            </div>
          )}
        </>
      )}

      <div>
        <Label htmlFor={`${side}-note`}>{t("noteLabel")}</Label>
        <Textarea
          id={`${side}-note`}
          rows={2}
          placeholder={t("notePlaceholder")}
          value={endpoint?.note ?? ""}
          onChange={(e) => setValue(`${side}.note`, e.target.value)}
        />
        <FieldError message={error?.note?.message} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`${side}-contact-name`}>{t("contactName")}</Label>
          <Input
            id={`${side}-contact-name`}
            placeholder={t("contactNamePlaceholder")}
            value={endpoint?.contactName ?? ""}
            onChange={(e) => setValue(`${side}.contactName`, e.target.value)}
          />
          <FieldError message={error?.contactName?.message} />
        </div>
        <div>
          <Label htmlFor={`${side}-contact-phone`} required>
            {t("contactPhone")}
          </Label>
          <PhoneInput
            id={`${side}-contact-phone`}
            placeholder={t("contactPhonePlaceholder")}
            value={endpoint?.contactPhone ?? ""}
            onChange={(next) =>
              setValue(`${side}.contactPhone`, next, { shouldValidate: true })
            }
          />
          <FieldError message={error?.contactPhone?.message} />
        </div>
      </div>

      <div>
        <Label required>{t("locationType")}</Label>
        <Select
          value={locationType}
          onValueChange={(v) =>
            setValue(`${side}.locationType`, v as LocationType)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder={t("select")} />
          </SelectTrigger>
          <SelectContent>
            {LOCATION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {tTypes(type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={error?.locationType?.message} />
      </div>

      {/* Floor and lift change the job materially, so an apartment must say. */}
      {locationType === "apartment" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${side}-floor`} required>
              {t("floor")}
            </Label>
            <Input
              id={`${side}-floor`}
              type="number"
              min={0}
              // `floor` passes through a preprocess, so its input type is
              // `unknown`; only a number is meaningful to show.
              value={typeof endpoint?.floor === "number" ? endpoint.floor : ""}
              onChange={(e) =>
                setValue(
                  `${side}.floor`,
                  e.target.value === "" ? undefined : Number(e.target.value)
                )
              }
            />
            <FieldError message={error?.floor?.message} />
          </div>
          <ToggleRow
            id={`${side}-lift`}
            label={t("lift")}
            description={t("liftHint")}
            checked={Boolean(endpoint?.hasLift)}
            onChange={(v) => setValue(`${side}.hasLift`, v)}
          />
        </div>
      )}
      <FieldError message={error?.hasLift?.message} />
    </section>
  );
}

function WhenStep({
  form,
  timing,
  onTimingChange,
}: StepProps & {
  timing: JobFormApi["timing"];
  onTimingChange: JobFormApi["handleTimingChange"];
}) {
  const errors = form.formState.errors;

  return (
    <TimingField
      timing={timing}
      onChange={onTimingChange}
      pickupError={errors.pickupFrom?.message ?? errors.pickupUntil?.message}
      dropoffError={errors.dropoffFrom?.message ?? errors.dropoffUntil?.message}
    />
  );
}

function BudgetStep({ form }: StepProps) {
  const t = useTranslations("create.budget");
  const { register, formState } = form;

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="budgetEuros" required>
          {t("label")}
        </Label>
        <div className="relative mt-1">
          <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-xl font-semibold text-muted-foreground">
            €
          </span>
          <Input
            id="budgetEuros"
            type="number"
            step="1"
            min={1}
            className="h-14 pl-10 text-2xl font-semibold"
            {...register("budgetEuros")}
          />
        </div>
        <FieldError message={formState.errors.budgetEuros?.message} />
        <p className="mt-2 text-sm text-muted-foreground">{t("hint")}</p>
      </div>

      <PublishTimingField form={form} />
    </div>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
