import { useState, useCallback, useEffect, useMemo } from "react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { useRouter, useSearchParams } from "next/navigation";
import type { CreateStep } from "../types";
import { useTranslations } from "next-intl";
import { createListing, updateListing, fetchListingById } from "../api/createListing";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  getCreateListingSchema,
  type CreateListingFormValues,
} from "../schemas";

/**
 * Custom hook for managing create/edit listing form
 * Follows Single Responsibility Principle - handles form state and navigation
 *
 * Supports both create and edit modes via ?edit=[id] query param
 */
export function useCreateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditMode = !!editId;
  const t = useTranslations("create.messages");
  const tValidation = useTranslations("create");

  const steps: CreateStep[] = ["Item", "Pickup", "Price"];

  const [currentStep, setCurrentStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(isEditMode);

  // Create localized schema
  const schema = useMemo(() => getCreateListingSchema((key) => {
    // Handle simple keys or nested access if needed
    // Zod keys are like "validation.titleMin"
    // tValidation expects "validation.titleMin"
    return tValidation(key);
  }), [tValidation]);

  const form = useForm<CreateListingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      quantity: 1,
      designation: "",
      categoryId: "electronics",
      condition: "used_good",
      knowDimensions: false,
      length: 0,
      width: 0,
      height: 0,
      weight: "",
      departStreet: "",
      departCity: "",
      departPostalCode: "",
      departCountry: "",
      departLatitude: null,
      departLongitude: null,
      isAuction: true,
      startingBid: 0,
      buyNowPrice: undefined, // Explicit undefined to keep input controlled
      auctionDuration: "7",
      publicInfo: "",
    },
    mode: "onChange",
  });

  // Fetch existing listing data for edit mode
  useEffect(() => {
    if (!editId) return;

    const fetchListing = async () => {
      try {
        setIsLoadingData(true);
        const listing = await fetchListingById(editId);

        // Pre-fill form with existing data
        form.reset({
          quantity: 1,
          designation: listing.title || "",
          categoryId: listing.categoryId || "electronics",
          condition: (listing.condition || "used_good") as "new" | "used_like_new" | "used_good" | "used_fair",
          knowDimensions: true,
          length: listing.length || 0,
          width: listing.width || 0,
          height: listing.height || 0,
          weight: listing.weight || "",
          departStreet: listing.address || "",
          departCity: listing.city || "",
          departPostalCode: "",
          departCountry: "",
          departLatitude: listing.lat || null,
          departLongitude: listing.lng || null,
          isAuction: listing.type === "auction",
          startingBid: listing.startPrice ? listing.startPrice / 100 : 0,
          buyNowPrice: listing.buyNowPrice
            ? listing.buyNowPrice / 100
            : undefined,
          auctionDuration: "7",
          publicInfo: listing.description || "",
        });

        // Set photos from existing images
        if (listing.images && listing.images.length > 0) {
          setPhotos(listing.images.map((img: { url: string }) => img.url));
        }
      } catch (error) {
        console.error("Error fetching listing:", error);
        toast.error(error instanceof Error ? error.message : "Failed to load listing");
        router.push("/my-auctions");
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchListing();
  }, [editId, form, router]);

  // Handle photo changes
  const handlePhotosChange = useCallback((newPhotos: string[]) => {
    setPhotos(newPhotos);
  }, []);

  // Navigate to next step
  const handleNext = useCallback(async () => {
    // Validate current step fields
    let isValid = false;
    if (currentStep === 0) {
      // Item step validation
      const fieldsValid = await form.trigger([
        "designation",
        "categoryId",
        "condition",
        "length",
        "width",
        "height",
        "weight",
      ]);
      isValid = fieldsValid;

      if (photos.length === 0) {
        toast.error(t("uploadPhoto"));
        isValid = false;
      }
    } else if (currentStep === 1) {
      // Pickup step validation
      isValid = await form.trigger([
        "departStreet",
        "departCity",
        "departPostalCode",
        "departCountry",
      ]);
    } else {
      isValid = true;
    }

    if (isValid) {
      if (currentStep < steps.length - 1) {
        setCurrentStep((prev) => prev + 1);
      }
    }
  }, [currentStep, steps.length, form, photos, t]);

  // Navigate to previous step
  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  // Submit form
  const onSubmit = async (data: CreateListingFormValues) => {
    if (photos.length === 0) {
      toast.error(t("uploadPhoto"));
      return;
    }

    const listingData = {
      title: data.designation,
      description: data.publicInfo,
      categoryId: data.categoryId,
      condition: data.condition as "new" | "used_like_new" | "used_good" | "used_fair",
      type: "auction" as const,
      startPrice: Math.round(data.startingBid * 100), // Convert to cents
      buyNowPrice: data.buyNowPrice
        ? Math.round(data.buyNowPrice * 100)
        : undefined,
      auctionDuration: data.auctionDuration,
      length: data.length,
      width: data.width,
      height: data.height,
      weight: data.weight,
      images: photos,
      location: {
        lat: data.departLatitude || 0,
        lng: data.departLongitude || 0,
        address: data.departStreet,
        city: data.departCity,
        country: data.departCountry,
        postalCode: data.departPostalCode,
      },
    };

    try {
      if (isEditMode && editId) {
        // Update existing listing
        const promise = updateListing(editId, listingData);

        toast.promise(promise, {
          loading: (
            <div className="flex items-center gap-2">
              <LottieLoader width={20} height={20} />
              {t("updating")}
            </div>
          ),
          success: () => {
            router.push("/my-auctions");
            return t("updated");
          },
          error: (err) => {
            return err.message || t("updateError");
          },
        });
      } else {
        // Create new listing
        const promise = createListing(listingData);

        toast.promise(promise, {
          loading: (
            <div className="flex items-center gap-2">
              <LottieLoader width={20} height={20} />
              {t("creating")}
            </div>
          ),
          success: (res) => {
            router.push(`/create/success?id=${res.data.id}`);
            return t("created");
          },
          error: (err) => {
            return err.message || t("createError");
          },
        });
      }
    } catch (error) {
      console.error("Submit error:", error);
    }
  };

  return {
    currentStep,
    steps,
    photos,
    form,
    handlePhotosChange,
    handleNext,
    handlePrev,
    handleSubmit: form.handleSubmit(onSubmit),
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === steps.length - 1,
    isEditMode,
    isLoadingData,
  };
}
