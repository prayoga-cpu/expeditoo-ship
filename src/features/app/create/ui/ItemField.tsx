"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { JobFormApi } from "../hooks/useJobForm";
import { FieldError } from "./FieldError";

/**
 * What is moving and how many of it, on one line.
 *
 * Quantity used to sit on a row of its own after the weight and size cards,
 * three controls away from the thing it counts, and a requester filing
 * feedback from /create asked for it beside the item instead. The count gets a
 * narrow fixed column — it is a few digits at most — and the title keeps the
 * room.
 */
export function ItemField({ form }: { form: JobFormApi["form"] }) {
  const t = useTranslations("create.what");
  const { register, formState } = form;
  const errors = formState.errors;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
      <div className="min-w-0">
        <Label htmlFor="title">{t("titleLabel")}</Label>
        <Input
          id="title"
          placeholder={t("titlePlaceholder")}
          {...register("title")}
        />
        <FieldError message={errors.title?.message} />
      </div>

      <div>
        <Label htmlFor="quantity">{t("quantity")}</Label>
        <Input
          id="quantity"
          type="number"
          min={1}
          inputMode="numeric"
          {...register("quantity")}
        />
        <FieldError message={errors.quantity?.message} />
      </div>
    </div>
  );
}
