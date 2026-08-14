"use client";

import { useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { isValidPlate } from "@/lib/french-identifiers";
import { VEHICLE_TYPES } from "@/server/dto/carrier.dto";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddVehicle } from "../hooks/useCarrier";

type Translate = (key: string) => string;

const optionalNumeric = (message: string) =>
  z
    .string()
    .refine((value) => value === "" || Number(value) > 0, message)
    .optional();

/**
 * Inputs stay strings for react-hook-form; the numbers are parsed at submit.
 * The REST layer revalidates against `createVehicleSchema`.
 */
function buildSchema(t: Translate) {
  return z.object({
    type: z.enum(VEHICLE_TYPES, { errorMap: () => ({ message: t("errors.type") }) }),
    make: z.string().max(80).optional(),
    model: z.string().max(80).optional(),
    year: optionalNumeric(t("errors.year")),
    plateNumber: z
      .string()
      .refine((value) => isValidPlate(value.toUpperCase()), t("errors.plate")),
    maxWeightKg: z
      .string()
      .refine(
        (value) => Number(value) > 0 && Number(value) <= 44_000,
        t("errors.weight")
      ),
    maxLengthCm: optionalNumeric(t("errors.dimension")),
    maxWidthCm: optionalNumeric(t("errors.dimension")),
    maxHeightCm: optionalNumeric(t("errors.dimension")),
  });
}

type VehicleFormValues = z.infer<ReturnType<typeof buildSchema>>;

interface VehicleFormProps {
  onDone: () => void;
}

export function VehicleForm({ onDone }: VehicleFormProps) {
  const t = useTranslations("carrier.fleet.form");
  const tTypes = useTranslations("carrier.fleet.types");
  const add = useAddVehicle();

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(buildSchema(t)),
    defaultValues: {
      type: undefined,
      make: "",
      model: "",
      year: "",
      plateNumber: "",
      maxWeightKg: "",
      maxLengthCm: "",
      maxWidthCm: "",
      maxHeightCm: "",
    },
  });

  function onSubmit(values: VehicleFormValues) {
    add.mutate(
      {
        type: values.type,
        make: values.make || undefined,
        model: values.model || undefined,
        year: values.year ? Number(values.year) : undefined,
        plateNumber: values.plateNumber.toUpperCase(),
        maxWeightKg: Number(values.maxWeightKg),
        maxLengthCm: values.maxLengthCm ? Number(values.maxLengthCm) : undefined,
        maxWidthCm: values.maxWidthCm ? Number(values.maxWidthCm) : undefined,
        maxHeightCm: values.maxHeightCm ? Number(values.maxHeightCm) : undefined,
      },
      {
        onSuccess: () => {
          form.reset();
          onDone();
        },
      }
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TypeField control={form.control} t={t} tTypes={tTypes} />
              <TextField control={form.control} name="plateNumber" label={t("plate")} placeholder="AB-123-CD" />
              <TextField control={form.control} name="make" label={t("make")} placeholder="Renault" />
              <TextField control={form.control} name="model" label={t("model")} placeholder="Master" />
              <TextField control={form.control} name="year" label={t("year")} placeholder="2021" inputMode="numeric" />
              <TextField control={form.control} name="maxWeightKg" label={t("maxWeightKg")} placeholder="1200" inputMode="numeric" />
              <TextField control={form.control} name="maxLengthCm" label={t("maxLengthCm")} placeholder="300" inputMode="numeric" />
              <TextField control={form.control} name="maxWidthCm" label={t("maxWidthCm")} placeholder="170" inputMode="numeric" />
              <TextField control={form.control} name="maxHeightCm" label={t("maxHeightCm")} placeholder="180" inputMode="numeric" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onDone}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={add.isPending}>
                {add.isPending ? t("saving") : t("submit")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

interface TypeFieldProps {
  control: Control<VehicleFormValues>;
  t: Translate;
  tTypes: Translate;
}

function TypeField({ control, t, tTypes }: TypeFieldProps) {
  return (
    <FormField
      control={control}
      name="type"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("type")}</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("typePlaceholder")} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {VEHICLE_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {tTypes(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface TextFieldProps {
  control: Control<VehicleFormValues>;
  name: Exclude<keyof VehicleFormValues, "type">;
  label: string;
  placeholder?: string;
  inputMode?: "numeric";
}

function TextField({ control, name, label, placeholder, inputMode }: TextFieldProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input placeholder={placeholder} inputMode={inputMode} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
