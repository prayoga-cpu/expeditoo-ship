"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Euro, Send, Calculator, Info } from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { toast } from "sonner";
import { useCalculatePrice } from "@/features/app/common/hooks";
import { submitProposal } from "../api";
import { useTranslations } from "next-intl";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

/**
 * Shipment data needed for price calculation
 */
export interface ShipmentPricingData {
  originLat: number;
  originLng: number;
  destinationLat: number;
  destinationLng: number;
  packageWeight?: number | null;
  packageDimensions?: string | null; // Format: "LxWxH" in cm
}

interface ProposalFormProps {
  shipmentId: string;
  isMobile?: boolean;
  /** Optional shipment data for reference price calculation */
  shipmentData?: ShipmentPricingData;
}

/**
 * Parse dimensions string "LxWxH" to individual values
 */
function parseDimensions(dimensions: string | null | undefined): {
  length: number;
  width: number;
  height: number;
} {
  if (!dimensions) {
    return { length: 30, width: 20, height: 15 }; // Default medium box
  }

  const parts = dimensions.toLowerCase().split("x").map((p) => parseFloat(p.trim()));
  if (parts.length >= 3 && parts.every((p) => !isNaN(p))) {
    return { length: parts[0], width: parts[1], height: parts[2] };
  }

  return { length: 30, width: 20, height: 15 }; // Default fallback
}

export function ProposalForm({
  shipmentId,
  isMobile = false,
  shipmentData,
}: ProposalFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations("driver.proposalForm");

  // Create schema with translated error message
  const proposalSchema = z.object({
    price: z.string().min(1, t("priceRequired")),
    estimatedDelivery: z.date().optional(), // Changed to Date
    notes: z.string().optional(),
  });

  type ProposalFormValues = z.infer<typeof proposalSchema>;

  // Reference price calculation
  const { calculate, result: priceResult, isCalculating } = useCalculatePrice();

  // Calculate reference price when shipment data is available
  useEffect(() => {
    if (shipmentData && shipmentData.originLat && shipmentData.destinationLat) {
      const dimensions = parseDimensions(shipmentData.packageDimensions);

      calculate({
        origin: {
          lat: shipmentData.originLat,
          lng: shipmentData.originLng,
        },
        destination: {
          lat: shipmentData.destinationLat,
          lng: shipmentData.destinationLng,
        },
        package: {
          ...dimensions,
          weight: shipmentData.packageWeight || 5, // Default 5kg
        },
        speed: "STANDARD",
      });
    }
  }, [shipmentData, calculate]);

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      price: "",
      notes: "",
    },
  });

  // Auto-fill price when reference calculation completes
  const handleUseReferencePrice = () => {
    if (priceResult?.breakdown.total) {
      form.setValue("price", (priceResult.breakdown.total / 100).toFixed(2));
    }
  };

  async function onSubmit(data: ProposalFormValues) {
    setIsSubmitting(true);
    try {
      await submitProposal({
        shipmentId,
        price: Math.round(parseFloat(data.price) * 100), // Convert to cents
        message: data.notes,
        estimatedDelivery: data.estimatedDelivery,
      });

      toast.success(t("successMessage"));
      form.reset();

      // Invalidate queries to update "My Shipments" list (Waiting tab)
      await queryClient.invalidateQueries({ queryKey: ["shipments"] });

      if (!isMobile) {
        router.push("/driver/shipments");
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("already")) {
        toast.error(t("alreadySubmitted"));
        return;
      }
      const errorMessage = error instanceof Error ? error.message : t("errorMessage");
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Reference Price Display Component
  const ReferencePriceBox = () => {
    if (!shipmentData) return null;

    return (
      <div className="rounded-lg border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-100">
            <Calculator className="w-4 h-4" />
            <span>{t("referencePrice")}</span>
          </div>
          {isCalculating && (
            <LottieLoader width={20} height={20} />
          )}
        </div>

        {priceResult ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                €{(priceResult.breakdown.total / 100).toFixed(2)}
              </span>
              <Badge variant="secondary" className="text-xs">
                {priceResult.distance.km.toFixed(1)} km
              </Badge>
            </div>

            {/* Price breakdown mini */}
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div className="flex justify-between">
                <span>{t("baseDistance")}</span>
                <span>€{((priceResult.breakdown.baseRate + priceResult.breakdown.distanceCost) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("weightVolume")}</span>
                <span>€{((priceResult.breakdown.weightCost + priceResult.breakdown.volumeCost) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("platformFee")} ({10}%)</span>
                <span>€{(priceResult.breakdown.serviceFee / 100).toFixed(2)}</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full mt-2 gap-2"
              onClick={handleUseReferencePrice}
            >
              <Euro className="w-3 h-3" />
              {t("useThisPrice")}
            </Button>
          </div>
        ) : !isCalculating ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="w-3 h-3" />
            <span>{t("unableToCalculate")}</span>
          </div>
        ) : null}
      </div>
    );
  };

  // Helper for Date Picker Field
  const DatePickerField = ({ field }: { field: any }) => (
    <Popover>
      <PopoverTrigger asChild>
        <FormControl>
          <Button
            variant={"outline"}
            className={cn(
              "w-full pl-3 text-left font-normal",
              !field.value && "text-muted-foreground"
            )}
          >
            {field.value ? (
              format(field.value, "PPP")
            ) : (
              <span>{t("pickDate")}</span>
            )}
            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </FormControl>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarComponent
          mode="single"
          selected={field.value}
          onSelect={field.onChange}
          disabled={(date) =>
            date < new Date(new Date().setHours(0, 0, 0, 0))
          }
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );

  // Mobile Sticky Bar Version
  if (isMobile) {
    return (
      <div className="bg-background border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="p-4 space-y-3">
          {/* Reference price compact */}
          {priceResult && (
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <div className="flex items-center gap-2 text-sm">
                <Calculator className="w-4 h-4 text-blue-600" />
                <span className="text-blue-700 dark:text-blue-300 font-medium">
                  {t("suggested")}: €{priceResult.breakdown.total.toFixed(2)}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {priceResult.distance.km.toFixed(0)} km
                </Badge>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleUseReferencePrice}
              >
                {t("use")}
              </Button>
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">
                      {t("yourPrice")}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="pl-9 h-11 text-base"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="estimatedDelivery"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-xs text-muted-foreground">
                      {t("estimatedDeliveryOptional")}
                    </FormLabel>
                    <DatePickerField field={field} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1 h-11 gap-2 font-semibold"
                  disabled={isSubmitting}
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? t("submitting") : t("submit")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-4"
                  asChild
                >
                  <Link href="/driver/shipments">{t("cancel")}</Link>
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    );
  }

  // Desktop Card Version
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Euro className="w-5 h-5 text-primary" />
          {t("submitProposal")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Reference Price Box */}
        <ReferencePriceBox />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("yourProposedPrice")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="pl-9"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    {t("priceDescription")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="estimatedDelivery"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>{t("estimatedDeliveryDate")}</FormLabel>
                  <DatePickerField field={field} />
                  <FormDescription>
                    {t("deliveryDescription")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("notes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("notesPlaceholder")}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={isSubmitting}
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>

            <Button type="button" variant="outline" className="w-full" asChild>
              <Link href="/driver/shipments">{t("cancelGoBack")}</Link>
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
