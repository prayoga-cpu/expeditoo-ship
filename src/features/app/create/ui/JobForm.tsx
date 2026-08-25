"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper } from "@/components/Stepper";
import { LocationPickerField } from "@/components/ui/location-picker-field";
import { PhotoDropzone } from "./PhotoDropzone";
import { LOCATION_TYPES, type LocationType } from "../schemas";
import { useJobForm } from "../hooks/useJobForm";

type JobFormApi = ReturnType<typeof useJobForm>;

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
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6">
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
        {currentStep === 2 && <WhenStep form={form} />}
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
              {isSubmitting ? t("buttons.posting") : t("buttons.post")}
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
 * Taken from the hook rather than written as `UseFormReturn<JobFormValues>`:
 * a resolver adds a third generic for the transformed output, so the spelled-out
 * version is a different type from the one `useJobForm` actually returns.
 */
interface StepProps {
  form: JobFormApi["form"];
}

/**
 * Validation messages are translation keys, not sentences — a Zod schema has no
 * access to `useTranslations`. Anything that is not a known key is shown as-is
 * so a server message still reaches the reader rather than vanishing.
 */
function FieldError({ message }: { message?: string }) {
  const t = useTranslations();
  if (!message) return null;
  const text = message.startsWith("create.validation.") ? t(message) : message;
  return <p className="mt-1 text-sm text-destructive">{text}</p>;
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
      <div>
        <Label htmlFor="title">{t("titleLabel")}</Label>
        <Input
          id="title"
          placeholder={t("titlePlaceholder")}
          {...register("title")}
        />
        <FieldError message={errors.title?.message} />
      </div>

      <div>
        <Label htmlFor="description">{t("descriptionLabel")}</Label>
        <Textarea
          id="description"
          rows={4}
          placeholder={t("descriptionPlaceholder")}
          {...register("description")}
        />
        <FieldError message={errors.description?.message} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="weightKg">{t("weight")}</Label>
          <Input
            id="weightKg"
            type="number"
            step="0.1"
            {...register("weightKg")}
          />
          <FieldError message={errors.weightKg?.message} />
        </div>
        <div>
          <Label htmlFor="quantity">{t("quantity")}</Label>
          <Input id="quantity" type="number" min={1} {...register("quantity")} />
          <FieldError message={errors.quantity?.message} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="lengthCm">{t("length")}</Label>
          <Input id="lengthCm" type="number" step="1" {...register("lengthCm")} />
        </div>
        <div>
          <Label htmlFor="widthCm">{t("width")}</Label>
          <Input id="widthCm" type="number" step="1" {...register("widthCm")} />
        </div>
        <div>
          <Label htmlFor="heightCm">{t("height")}</Label>
          <Input id="heightCm" type="number" step="1" {...register("heightCm")} />
        </div>
      </div>
      <FieldError message={errors.lengthCm?.message} />

      <div className="space-y-3">
        <ToggleRow
          id="isFragile"
          label={t("fragile")}
          description={t("fragileHint")}
          checked={Boolean(watch("isFragile"))}
          onChange={(v) => setValue("isFragile", v)}
        />
        <ToggleRow
          id="needsHelp"
          label={t("help")}
          description={t("helpHint")}
          checked={Boolean(watch("needsHelp"))}
          onChange={(v) => setValue("needsHelp", v)}
        />
      </div>

      <div>
        <Label>{t("photos")}</Label>
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

  return (
    <section className="space-y-4">
      <h2 className="font-semibold">{title}</h2>

      {/* The shared picker rather than a private map: it already searches
          Nominatim, drags a pin, reverse-geocodes and refuses anywhere outside
          France, in both languages and both themes. */}
      <LocationPickerField
        id={`${side}-location`}
        value={{
          address: endpoint?.address ?? "",
          city: endpoint?.city ?? "",
          postalCode: endpoint?.postalCode ?? "",
          lat: endpoint?.lat ?? null,
          lng: endpoint?.lng ?? null,
        }}
        onChange={(next) => {
          setValue(`${side}.address`, next.address, { shouldValidate: true });
          setValue(`${side}.city`, next.city);
          setValue(`${side}.postalCode`, next.postalCode);
          if (next.lat !== null) setValue(`${side}.lat`, next.lat);
          if (next.lng !== null) setValue(`${side}.lng`, next.lng);
        }}
      />
      <FieldError message={error?.address?.message} />
      <FieldError message={error?.city?.message} />
      <FieldError message={error?.postalCode?.message} />
      <FieldError message={error?.lat?.message} />

      <div>
        <Label>{t("locationType")}</Label>
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
            <Label htmlFor={`${side}-floor`}>{t("floor")}</Label>
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

function WhenStep({ form }: StepProps) {
  const t = useTranslations("create.when");
  const { register, setValue, watch, formState } = form;
  const errors = formState.errors;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <DateTimeField
          label={t("pickupFrom")}
          error={errors.pickupFrom?.message}
          {...register("pickupFrom")}
        />
        <DateTimeField
          label={t("pickupUntil")}
          error={errors.pickupUntil?.message}
          {...register("pickupUntil")}
        />
        <DateTimeField
          label={t("dropoffFrom")}
          error={errors.dropoffFrom?.message}
          {...register("dropoffFrom")}
        />
        <DateTimeField
          label={t("dropoffUntil")}
          error={errors.dropoffUntil?.message}
          {...register("dropoffUntil")}
        />
      </div>

      <ToggleRow
        id="isFlexible"
        label={t("flexible")}
        description={t("flexibleHint")}
        checked={Boolean(watch("isFlexible"))}
        onChange={(v) => setValue("isFlexible", v)}
      />
    </div>
  );
}

function BudgetStep({ form }: StepProps) {
  const t = useTranslations("create.budget");
  const { register, formState } = form;

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="budgetEuros">{t("label")}</Label>
        <Input
          id="budgetEuros"
          type="number"
          step="1"
          min={1}
          {...register("budgetEuros")}
        />
        <FieldError message={formState.errors.budgetEuros?.message} />
        <p className="mt-2 text-sm text-muted-foreground">{t("hint")}</p>
      </div>
    </div>
  );
}

const DateTimeField = ({
  label,
  error,
  ...inputProps
}: React.ComponentProps<typeof Input> & { label: string; error?: string }) => (
  <div>
    <Label htmlFor={inputProps.name}>{label}</Label>
    <Input id={inputProps.name} type="datetime-local" {...inputProps} />
    <FieldError message={error} />
  </div>
);

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
