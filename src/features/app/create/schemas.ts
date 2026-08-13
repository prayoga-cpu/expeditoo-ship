import { z } from "zod";
import { listingConditionEnum } from "@/db/schema/listings";

export const getCreateListingSchema = (t: (key: string) => string) => z.object({
  // Item
  quantity: z.coerce.number().min(1).default(1),
  designation: z.string().min(3, t("validation.titleMin")),
  categoryId: z.string().min(1, t("validation.categoryRequired")),
  condition: z.enum(listingConditionEnum.enumValues),

  // Dimensions
  knowDimensions: z.boolean().default(false),
  length: z.coerce.number().positive(t("validation.lengthPositive")),
  width: z.coerce.number().positive(t("validation.widthPositive")),
  height: z.coerce.number().positive(t("validation.heightPositive")),
  weight: z.string().min(1, t("validation.weightRequired")),

  // Pickup (Location)
  departStreet: z.string().min(5, t("validation.addressRequired")),
  departCity: z.string().min(2, t("validation.cityRequired")),
  departPostalCode: z.string().min(3, t("validation.postalCodeRequired")),
  departCountry: z.string().min(2, t("validation.countryRequired")),
  departLatitude: z.number().nullable(),
  departLongitude: z.number().nullable(),

  // Delivery (Optional/Future)
  arriveeStreet: z.string().optional(),

  // Price & Auction
  isAuction: z.boolean().default(true),
  startingBid: z.coerce.number().min(0, t("validation.startingBidMin")),
  buyNowPrice: z.coerce.number().optional(),
  auctionDuration: z.string().min(1, t("validation.durationRequired")),

  // Description
  publicInfo: z.string().min(10, t("validation.descriptionMin")),
});

// Infer type from a dummy schema instance
const _dummySchema = getCreateListingSchema((k) => k);
export type CreateListingFormValues = z.infer<typeof _dummySchema>;

