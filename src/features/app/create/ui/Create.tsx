"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Stepper } from "@/components/Stepper";
import { PhotoDropzone } from "./PhotoDropzone";
import { AddressMapPicker } from "./AddressMapPicker";
import { PurchaseSlipUploader } from "./PurchaseSlipUploader";
import { AIPriceRecommendationCard } from "./AIPriceRecommendationCard";
import { useAISlipProcessor } from "../hooks/useAISlipProcessor";
import { useAIPriceRecommendation } from "../hooks/useAIPriceRecommendation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CreateStep } from "../types";
import type { UseFormReturn } from "react-hook-form";
import type { CreateListingFormValues } from "../schemas";
import type { ProcessSlipOutput } from "@/server/dto/ai.dto";

interface CreateProps {
  currentStep: number;
  _steps: CreateStep[];
  photos: string[];
  form: UseFormReturn<CreateListingFormValues>;
  isFirstStep: boolean;
  isLastStep: boolean;
  isEditMode?: boolean;
  _isLoadingData?: boolean;
  onPhotosChange: (photos: string[]) => void;
  onNext: () => void;
  onPrev: () => void;
  onSubmit: () => void;
}

export function Create({
  currentStep,
  _steps,
  photos,
  form,
  isFirstStep,
  isLastStep,
  isEditMode = false,
  _isLoadingData = false,
  onPhotosChange,
  onNext,
  onPrev,
  onSubmit,
}: CreateProps) {
  const t = useTranslations("create");
  const tCommon = useTranslations("common");
  const tListing = useTranslations("listing");
  const { processExtractedData, priceEstimate } = useAISlipProcessor();

  // State for slip data to pass to AI recommendation
  const [slipData, setSlipData] = useState<ProcessSlipOutput | null>(null);
  const [prevStep, setPrevStep] = useState(currentStep);
  
  // Test mode detection: Enable via URL parameter ?testMode=true or localStorage
  // Use state + effect to avoid SSR/hydration mismatch
  const [isTestMode, setIsTestMode] = useState(false);
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const testModeFromUrl = urlParams.get('testMode') === 'true';
    const testModeFromStorage = localStorage.getItem('expeditoo_test_mode') === 'true';
    if (testModeFromUrl || testModeFromStorage) {
      setIsTestMode(true);
    }
  }, []);

  // AI Price Recommendation hook
  const aiRecommendation = useAIPriceRecommendation({
    onApplyStartingBid: (price) => form.setValue("startingBid", price),
    onApplyBuyNowPrice: (price) => form.setValue("buyNowPrice", price),
  });

  const translatedSteps = [
    t("steps.item"),
    t("steps.logistics"),
    t("steps.summary"),
  ];

  // Fetch AI recommendation when entering Step 3
  useEffect(() => {
    // Only trigger when transitioning TO step 2 (index 2 = Step 3)
    if (currentStep === 2 && prevStep !== 2 && !aiRecommendation.hasAttempted) {
      triggerAIRecommendation();
    }
    setPrevStep(currentStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const triggerAIRecommendation = useCallback(() => {
    const formValues = form.getValues();
    aiRecommendation.fetchRecommendation(
      {
        title: formValues.designation,
        category: formValues.categoryId,
        condition: formValues.condition,
        weight: formValues.weight,
        dimensions: {
          length: formValues.length || 0,
          width: formValues.width || 0,
          height: formValues.height || 0,
        },
        quantity: formValues.quantity,
        description: formValues.publicInfo,
      },
      {
        city: formValues.departCity,
        country: formValues.departCountry,
      },
      photos,
      slipData
    );
  }, [form, photos, slipData, aiRecommendation]);

  const handleSlipProcessed = (data: {
    dimensions?: { length: number; width: number; height: number };
    weight?: string;
    price?: number;
    description?: string;
  }) => {
    // Store slip data for AI recommendation
    setSlipData({
      dimensions: data.dimensions,
      weight: data.weight,
      price: data.price,
      description: data.description,
    });

    // Auto-fill dimensions
    if (data.dimensions) {
      form.setValue("length", data.dimensions.length);
      form.setValue("width", data.dimensions.width);
      form.setValue("height", data.dimensions.height);
    }

    // Auto-fill weight
    if (data.weight) {
      form.setValue("weight", data.weight);
    }

    // Auto-fill description
    if (data.description) {
      form.setValue("designation", data.description);
    }

    // Process and store price estimate (legacy - still used for Step 1 display)
    const processed = processExtractedData({
      dimensions: data.dimensions,
      weight: data.weight,
      price: data.price,
      description: data.description,
    });

    // Don't auto-fill starting bid anymore - let AI recommendation handle it in Step 3
    // But keep a fallback if user skips directly
    const priceToUse = processed.estimatedPrice || data.price || 0;
    if (priceToUse > 0 && !form.getValues("startingBid")) {
      form.setValue("startingBid", priceToUse);
    }
  };

  return (
    <div className="mx-auto pb-4 min-h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 md:mb-6">
        {!isFirstStep && (
          <button
            onClick={onPrev}
            className="p-2 hover:bg-muted rounded-lg transition-all duration-200 ease-out"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}
        <h1 className="hidden md:block text-2xl md:text-3xl font-bold text-foreground">
          {isEditMode ? t("titleEdit") : t("titleNew")}
        </h1>
      </div>

      {/* Stepper */}
      <Stepper steps={translatedSteps} currentStep={currentStep} />

      {/* Step Content */}
      <Form {...form}>
        <div className="bg-card rounded-2xl p-6 md:p-8 shadow-sm border border-border/50 mb-6 space-y-8 flex-1">
          {/* Step 1: Item */}
          {currentStep === 0 && (
            <div className="space-y-8">
              <div className="space-y-4">
                <Label className="text-lg font-semibold text-foreground">
                  {t("photos.title")}
                </Label>
                <PhotoDropzone
                  photos={photos}
                  onPhotosChange={onPhotosChange}
                />
              </div>

              <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border border-primary/10 rounded-2xl p-4 space-y-4">
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center shadow-sm shrink-0">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-foreground">
                        {t("photos.aiFeature.new")}
                      </p>
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                        {t("photos.aiFeature.badge")}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("photos.aiFeature.description")}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-primary/10">
                  <Label className="text-sm font-medium mb-2 block">
                    {t("photos.aiFeature.label")}
                  </Label>
                  <PurchaseSlipUploader
                    onSlipProcessed={handleSlipProcessed}
                    onError={(error) => {
                      console.error("Slip processing error:", error);
                    }}
                  />
                  {priceEstimate && (
                    <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                      <p className="text-xs text-muted-foreground mb-1">
                        {t("photos.aiFeature.estimateLabel")}
                      </p>
                      <p className="text-lg font-bold text-primary">
                        €{priceEstimate.estimatedPrice.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {priceEstimate.reasoning}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.quantity")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="h-12 rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="designation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.title")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("form.titlePlaceholder")}
                        {...field}
                        className="h-12 rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.category")}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full h-12! rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all">
                            <SelectValue
                              placeholder={t("form.selectCategory")}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="electronics">
                            {tCommon("categories.electronics")}
                          </SelectItem>
                          <SelectItem value="furniture">
                            {tCommon("categories.furniture")}
                          </SelectItem>
                          <SelectItem value="clothing">
                            {tCommon("categories.clothing")}
                          </SelectItem>
                          <SelectItem value="vehicles">
                            {tCommon("categories.vehicles")}
                          </SelectItem>
                          <SelectItem value="others">
                            {tCommon("categories.others")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("form.condition")}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full h-12! rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all">
                            <SelectValue
                              placeholder={t("form.selectCondition")}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">
                            {tListing("conditions.new")}
                          </SelectItem>
                          <SelectItem value="used_like_new">
                            {tListing("conditions.likeNew")}
                          </SelectItem>
                          <SelectItem value="used_good">
                            {tListing("conditions.good")}
                          </SelectItem>
                          <SelectItem value="used_fair">
                            {tListing("conditions.acceptable")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.weight.label")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full h-12! rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all">
                          <SelectValue
                            placeholder={t("form.weight.placeholder")}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0-5">
                          {t("form.weight.ranges.0_5")}
                        </SelectItem>
                        <SelectItem value="5-10">
                          {t("form.weight.ranges.5_10")}
                        </SelectItem>
                        <SelectItem value="10-25">
                          {t("form.weight.ranges.10_25")}
                        </SelectItem>
                        <SelectItem value="25-50">
                          {t("form.weight.ranges.25_50")}
                        </SelectItem>
                        <SelectItem value="50+">
                          {t("form.weight.ranges.50_plus")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t("form.dimensions.label")}
                </Label>
                <div className="grid grid-cols-3 gap-4 items-start">
                  <FormField
                    control={form.control}
                    name="length"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground ml-1">
                          {t("form.dimensions.length")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={tCommon("units.cm")}
                            type="number"
                            {...field}
                            className="h-12 rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all text-center"
                          />
                        </FormControl>
                        <FormMessage className="text-left" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="width"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground ml-1">
                          {t("form.dimensions.width")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={tCommon("units.cm")}
                            type="number"
                            {...field}
                            className="h-12 rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all text-center"
                          />
                        </FormControl>
                        <FormMessage className="text-left" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="height"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground ml-1">
                          {t("form.dimensions.height")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={tCommon("units.cm")}
                            type="number"
                            {...field}
                            className="h-12 rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all text-center"
                          />
                        </FormControl>
                        <FormMessage className="text-left" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t("form.size.label")}
                </Label>
                <div className="h-12 rounded-xl bg-muted/30 border border-transparent flex items-center px-3 text-muted-foreground">
                  {(() => {
                    const l = Number(form.watch("length"));
                    const w = Number(form.watch("width"));
                    const h = Number(form.watch("height"));
                    if (!l || !w || !h) return t("form.size.placeholder");
                    const vol = l * w * h;
                    if (vol < 1000) return t("form.size.xs");
                    if (vol < 10000) return t("form.size.s");
                    if (vol < 60000) return t("form.size.m");
                    if (vol < 200000) return t("form.size.l");
                    if (vol < 1000000) return t("form.size.xl");
                    return t("form.size.xxl");
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Pickup */}
          {currentStep === 1 && (
            <div className="space-y-8">
              <div className="space-y-2">
                <Label className="text-lg font-bold">
                  {t("logistics.pickup")}
                </Label>
                <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-lg mb-2 border border-blue-100 dark:border-blue-900/50">
                  <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <span className="text-lg">ℹ️</span>
                    {t("logistics.searchMap")}
                  </p>
                </div>
                <AddressMapPicker
                  latitude={form.watch("departLatitude")}
                  longitude={form.watch("departLongitude")}
                  onLocationChange={(lat, lng) => {
                    // Prevent updates if values haven't effectively changed to avoid cycles
                    const currentLat = form.getValues("departLatitude");
                    const currentLng = form.getValues("departLongitude");
                    if (currentLat !== lat || currentLng !== lng) {
                      form.setValue("departLatitude", lat);
                      form.setValue("departLongitude", lng);
                    }
                  }}
                  onAddressSelect={(address) => {
                    form.setValue("departStreet", address.street);
                    form.setValue("departCity", address.city);
                    form.setValue("departPostalCode", address.postalCode);
                    form.setValue("departCountry", address.country);
                  }}
                  height="400px"
                  testMode={isTestMode}
                />
              </div>

              <div className="border-t border-border pt-6">
                <Label className="text-lg font-bold mb-4 block">
                  {t("logistics.addressDetails")}
                </Label>
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="departStreet"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("logistics.street")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("logistics.street")}
                            {...field}
                            className="h-12 rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="departCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("logistics.city")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("logistics.city")}
                              {...field}
                              className="h-12 rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="departPostalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("logistics.postalCode")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t("logistics.postalCode")}
                              {...field}
                              className="h-12 rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="departCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("logistics.country")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("logistics.country")}
                            {...field}
                            readOnly
                            className="h-12 rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all opacity-80"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Price & Auction */}
          {currentStep === 2 && (
            <div className="space-y-8">
              {/* AI Price Recommendation Card */}
              <AIPriceRecommendationCard
                recommendation={aiRecommendation.recommendation}
                isLoading={aiRecommendation.isLoading}
                error={aiRecommendation.error}
                hasAttempted={aiRecommendation.hasAttempted}
                hasSlip={!!slipData}
                onApplyStartingBid={aiRecommendation.applyStartingBid}
                onApplyBuyNowPrice={aiRecommendation.applyBuyNowPrice}
                onRefresh={aiRecommendation.refresh}
                onGetRecommendation={triggerAIRecommendation}
                appliedFields={aiRecommendation.appliedFields}
              />

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startingBid"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>{t("pricing.startingPrice")}</FormLabel>
                          {aiRecommendation.recommendation && (
                            <span className="text-xs text-muted-foreground">
                              {t("ai.recommended")}: €
                              {aiRecommendation.recommendation.recommendedStartingBid.toFixed(
                                2
                              )}
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                            €
                          </span>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={tCommon("formats.pricePlaceholder")}
                              {...field}
                              onBlur={(_e) => {
                                field.onBlur();
                                if (
                                  field.value !== undefined &&
                                  field.value !== null &&
                                  field.value.toString() !== ""
                                ) {
                                  const val = parseFloat(
                                    field.value.toString()
                                  );
                                  if (!isNaN(val)) {
                                    // Coerce to 2 decimal places
                                    field.onChange(parseFloat(val.toFixed(2)));
                                  }
                                }
                              }}
                              className="h-12 rounded-xl pl-8 bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all"
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="buyNowPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("pricing.buyNowPrice")}{" "}
                          <span className="text-muted-foreground font-normal">
                            {t("pricing.optional")}
                          </span>
                        </FormLabel>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                            €
                          </span>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={
                                aiRecommendation.recommendation
                                  ? aiRecommendation.recommendation.recommendedBuyNowPrice.toFixed(
                                      2
                                    )
                                  : tCommon("formats.pricePlaceholder")
                              }
                              {...field}
                              value={field.value ?? ""}
                              onBlur={(_e) => {
                                field.onBlur();
                                if (
                                  field.value !== undefined &&
                                  field.value !== null &&
                                  field.value.toString() !== ""
                                ) {
                                  const val = parseFloat(
                                    field.value.toString()
                                  );
                                  if (!isNaN(val)) {
                                    // Coerce to 2 decimal places
                                    field.onChange(parseFloat(val.toFixed(2)));
                                  }
                                }
                              }}
                              className="h-12 rounded-xl pl-8 bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all"
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="auctionDuration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("pricing.duration.label")}</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full h-12! rounded-xl bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all">
                            <SelectValue
                              placeholder={t("form.selectDuration")}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">
                            1 {t("pricing.days", { count: 1 })}
                          </SelectItem>
                          <SelectItem value="3">
                            3 {t("pricing.days", { count: 3 })}
                          </SelectItem>
                          <SelectItem value="5">
                            5 {t("pricing.days", { count: 5 })}
                          </SelectItem>
                          <SelectItem value="7">
                            7 {t("pricing.days", { count: 7 })}
                          </SelectItem>
                          <SelectItem value="10">
                            10 {t("pricing.days", { count: 10 })}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="publicInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("form.additionalInfo.label")}</FormLabel>
                    <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-lg mb-2 border border-blue-100 dark:border-blue-900/50">
                      <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                        <span className="text-lg">ℹ️</span>
                        {t("form.additionalInfo.warning")}
                      </p>
                    </div>
                    <FormControl>
                      <Textarea
                        placeholder={t("form.additionalInfo.placeholder")}
                        {...field}
                        className="rounded-xl min-h-[120px] bg-muted/30 border-transparent focus:bg-background focus:border-primary transition-all resize-none p-4"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>
      </Form>

      {/* Navigation Buttons */}
      <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-sm p-4 -mx-4 md:static md:p-0 md:mx-0 md:bg-transparent mt-auto border-t border-border/50 md:border-0">
        <div className="space-y-2">
          {!isLastStep ? (
            <>
              <Button
                onClick={onNext}
                className="w-full h-12 rounded-full text-base font-bold"
              >
                {t("buttons.next")}
              </Button>
              {!isFirstStep && (
                <Button
                  onClick={onPrev}
                  variant="outline"
                  className="w-full h-12 rounded-full text-base font-bold bg-transparent"
                >
                  {t("buttons.back")}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                onClick={onSubmit}
                className="w-full h-12 rounded-full text-base font-bold"
              >
                {isEditMode ? t("buttons.update") : t("buttons.submit")}
              </Button>
              <Button
                onClick={onPrev}
                variant="outline"
                className="w-full h-12 rounded-full text-base font-bold bg-transparent"
              >
                {t("buttons.back")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
