import { z } from "zod";

// ========================================
// User Preferences DTO
// ========================================
// Mirrors `UserPreferences` in `src/db/schema/users.ts` field for field —
// the two had drifted (this schema once validated `auctionResults`/`outbid`/
// `orderConfirmation`, none of which the DB shape or any service has ever
// read), so a PATCH from the Settings UI validated fine while silently
// updating nothing: `z.object()` strips a key it doesn't know rather than
// rejecting it, and every key the old UI sent was foreign to this schema.

export const emailNotificationPreferencesSchema = z.object({
    listingPublished: z.boolean(),
    offerReceived: z.boolean(),
    offerAccepted: z.boolean(),
    offerRejected: z.boolean(),
    paymentConfirmation: z.boolean(),
    shipmentUpdates: z.boolean(),
    invoiceReady: z.boolean(),
    marketing: z.boolean(),
    security: z.boolean(),
});

export const inAppNotificationPreferencesSchema = z.object({
    offerReceived: z.boolean(),
    offerAccepted: z.boolean(),
    offerRejected: z.boolean(),
    paymentConfirmation: z.boolean(),
    shipmentUpdates: z.boolean(),
    invoiceReady: z.boolean(),
    messages: z.boolean(),
});

export const userPreferencesSchema = z.object({
    notifications: z.object({
        email: emailNotificationPreferencesSchema,
        inApp: inAppNotificationPreferencesSchema,
    }),
});

export const updatePreferencesSchema = z.object({
    notifications: z
        .object({
            email: emailNotificationPreferencesSchema.partial(),
            inApp: inAppNotificationPreferencesSchema.partial(),
        })
        .partial(),
});

export type UserPreferencesDTO = z.infer<typeof userPreferencesSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
