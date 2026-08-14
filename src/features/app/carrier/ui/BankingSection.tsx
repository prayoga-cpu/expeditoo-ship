"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { Landmark } from "lucide-react";
import { isValidIban, isValidBic } from "@/lib/french-identifiers";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { useSetBanking } from "../hooks/useCarrier";
import type { CarrierApplication } from "../api/carrier.api";

interface BankingSectionProps {
  application: CarrierApplication;
}

/**
 * Full IBAN/BIC go straight to the API and are never echoed back:
 * the server keeps only the last 4 of each (carrier_kyc_spec.md §4.3).
 */
export function BankingSection({ application }: BankingSectionProps) {
  const t = useTranslations("carrier.application.banking");
  const setBanking = useSetBanking();

  const schema = z.object({
    iban: z.string().refine(isValidIban, t("errors.iban")),
    bic: z.string().refine(isValidBic, t("errors.bic")),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { iban: "", bic: "" },
  });

  function onSubmit(values: z.infer<typeof schema>) {
    setBanking.mutate(values, { onSuccess: () => form.reset() });
  }

  const hasBanking = Boolean(application.ibanLast4 && application.bicLast4);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasBanking && (
          <p className="text-sm text-muted-foreground">
            {t("onFile", {
              iban: application.ibanLast4 ?? "",
              bic: application.bicLast4 ?? "",
            })}
          </p>
        )}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <FormField
              control={form.control}
              name="iban"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("iban")}</FormLabel>
                  <FormControl>
                    <Input placeholder="FR76 3000 4000 05…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("bic")}</FormLabel>
                  <FormControl>
                    <Input placeholder="BNPAFRPP" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" variant="outline" disabled={setBanking.isPending}>
                {setBanking.isPending
                  ? t("saving")
                  : hasBanking
                    ? t("replace")
                    : t("save")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
