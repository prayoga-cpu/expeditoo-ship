"use client";

import type { UseFormReturn } from "react-hook-form";
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
import { PhotoDropzone } from "./PhotoDropzone";
import { AddressMapPicker } from "./AddressMapPicker";
import {
  LOCATION_TYPES,
  LOCATION_TYPE_LABELS,
  type JobFormValues,
} from "../schemas";
import { useJobForm } from "../hooks/useJobForm";

type JobFormApi = ReturnType<typeof useJobForm>;

/**
 * Posting a transport job: what moves, from where to where, when, and what the
 * shipper expects to pay. Four steps, each validated on its own so a shipper
 * is never blocked by a field on a screen they have not reached.
 */
export function JobForm(props: JobFormApi) {
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
        <h1 className="text-2xl font-semibold tracking-tight">
          Post a transport job
        </h1>
        <p className="text-sm text-muted-foreground">
          Carriers bid on your job. You choose who moves it.
        </p>
      </header>

      <Stepper steps={[...steps]} currentStep={currentStep} />

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
          variant="ghost"
          onClick={handlePrev}
          disabled={isFirstStep || isSubmitting}
        >
          Back
        </Button>

        <div className="flex gap-2">
          <Button variant="outline" onClick={saveDraft} disabled={isSubmitting}>
            Save draft
          </Button>
          {isLastStep ? (
            <Button onClick={publish} disabled={isSubmitting}>
              {isSubmitting ? "Posting…" : "Post job"}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={isSubmitting}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface StepProps {
  form: UseFormReturn<JobFormValues>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-destructive">{message}</p>;
}

function WhatStep({
  form,
  photos,
  onPhotosChange,
}: StepProps & { photos: string[]; onPhotosChange: (p: string[]) => void }) {
  const { register, formState, setValue, watch } = form;
  const errors = formState.errors;

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="title">What are you moving?</Label>
        <Input
          id="title"
          placeholder="Two-seater sofa and a coffee table"
          {...register("title")}
        />
        <FieldError message={errors.title?.message} />
      </div>

      <div>
        <Label htmlFor="description">Details</Label>
        <Textarea
          id="description"
          rows={4}
          placeholder="Describe the load, access, and anything a carrier should know before bidding."
          {...register("description")}
        />
        <FieldError message={errors.description?.message} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="weightKg">Weight (kg)</Label>
          <Input id="weightKg" type="number" step="0.1" {...register("weightKg")} />
          <FieldError message={errors.weightKg?.message} />
        </div>
        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input id="quantity" type="number" min={1} {...register("quantity")} />
          <FieldError message={errors.quantity?.message} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(["lengthCm", "widthCm", "heightCm"] as const).map((field) => (
          <div key={field}>
            <Label htmlFor={field}>
              {field.replace("Cm", "").replace(/^\w/, (c) => c.toUpperCase())} (cm)
            </Label>
            <Input id={field} type="number" step="1" {...register(field)} />
          </div>
        ))}
      </div>
      <FieldError message={errors.lengthCm?.message} />

      <div className="space-y-3">
        <ToggleRow
          id="isFragile"
          label="Fragile"
          description="Needs careful handling"
          checked={Boolean(watch("isFragile"))}
          onChange={(v) => setValue("isFragile", v)}
        />
        <ToggleRow
          id="needsHelp"
          label="Help loading"
          description="The carrier must help load and unload"
          checked={Boolean(watch("needsHelp"))}
          onChange={(v) => setValue("needsHelp", v)}
        />
      </div>

      <div>
        <Label>Photos (optional)</Label>
        <PhotoDropzone photos={photos} onPhotosChange={onPhotosChange} />
      </div>
    </div>
  );
}

function WhereStep({ form }: StepProps) {
  return (
    <div className="space-y-8">
      <EndpointFields form={form} side="pickup" title="Pickup" />
      <EndpointFields form={form} side="dropoff" title="Dropoff" />
    </div>
  );
}

function EndpointFields({
  form,
  side,
  title,
}: StepProps & { side: "pickup" | "dropoff"; title: string }) {
  const { setValue, watch, formState } = form;
  const endpoint = watch(side);
  const error = formState.errors[side];
  const locationType = endpoint?.locationType;

  return (
    <section className="space-y-4">
      <h2 className="font-semibold">{title}</h2>

      <AddressMapPicker
        latitude={endpoint?.lat ?? null}
        longitude={endpoint?.lng ?? null}
        onLocationChange={(lat, lng) => {
          setValue(`${side}.lat`, lat);
          setValue(`${side}.lng`, lng);
        }}
        onAddressSelect={(address) => {
          setValue(`${side}.address`, address.street);
          setValue(`${side}.city`, address.city);
          setValue(`${side}.postalCode`, address.postalCode);
        }}
        height="260px"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Address</Label>
          <Input
            value={endpoint?.address ?? ""}
            onChange={(e) => setValue(`${side}.address`, e.target.value)}
          />
          <FieldError message={error?.address?.message} />
        </div>
        <div>
          <Label>City</Label>
          <Input
            value={endpoint?.city ?? ""}
            onChange={(e) => setValue(`${side}.city`, e.target.value)}
          />
          <FieldError message={error?.city?.message} />
        </div>
        <div>
          <Label>Postal code</Label>
          <Input
            value={endpoint?.postalCode ?? ""}
            onChange={(e) => setValue(`${side}.postalCode`, e.target.value)}
          />
          <FieldError message={error?.postalCode?.message} />
        </div>
        <div>
          <Label>Location type</Label>
          <Select
            value={locationType}
            onValueChange={(v) =>
              setValue(`${side}.locationType`, v as (typeof LOCATION_TYPES)[number])
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {LOCATION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {LOCATION_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={error?.locationType?.message} />
        </div>
      </div>

      {/* Floor and lift change the job materially, so an apartment must say. */}
      {locationType === "apartment" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Floor</Label>
            <Input
              type="number"
              min={0}
              value={endpoint?.floor ?? ""}
              onChange={(e) => setValue(`${side}.floor`, Number(e.target.value))}
            />
            <FieldError message={error?.floor?.message} />
          </div>
          <ToggleRow
            id={`${side}-lift`}
            label="Lift available"
            description="Is there a lift to this floor?"
            checked={Boolean(endpoint?.hasLift)}
            onChange={(v) => setValue(`${side}.hasLift`, v)}
          />
        </div>
      )}
    </section>
  );
}

function WhenStep({ form }: StepProps) {
  const { register, setValue, watch, formState } = form;
  const errors = formState.errors;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <DateTimeField
          label="Pickup from"
          error={errors.pickupFrom?.message}
          {...register("pickupFrom")}
        />
        <DateTimeField
          label="Pickup until"
          error={errors.pickupUntil?.message}
          {...register("pickupUntil")}
        />
        <DateTimeField
          label="Delivery from"
          error={errors.dropoffFrom?.message}
          {...register("dropoffFrom")}
        />
        <DateTimeField
          label="Delivery until"
          error={errors.dropoffUntil?.message}
          {...register("dropoffUntil")}
        />
      </div>

      <ToggleRow
        id="isFlexible"
        label="Dates are flexible"
        description="Let carriers propose times outside your windows"
        checked={Boolean(watch("isFlexible"))}
        onChange={(v) => setValue("isFlexible", v)}
      />
    </div>
  );
}

function BudgetStep({ form }: StepProps) {
  const { register, formState } = form;

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="budgetEuros">What do you expect to pay? (€)</Label>
        <Input
          id="budgetEuros"
          type="number"
          step="1"
          min={1}
          {...register("budgetEuros")}
        />
        <FieldError message={formState.errors.budgetEuros?.message} />
        <p className="mt-2 text-sm text-muted-foreground">
          This is an expectation, not a limit. Carriers may bid above or below
          it, and you choose which offer to accept.
        </p>
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
    <Label>{label}</Label>
    <Input type="datetime-local" {...inputProps} />
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
