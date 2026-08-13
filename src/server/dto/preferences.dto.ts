import { z } from "zod";

// ========================================
// User Preferences DTO
// ========================================

export const emailNotificationPreferencesSchema = z.object({
    auctionResults: z.boolean(),
    outbid: z.boolean(),
    orderConfirmation: z.boolean(),
    paymentConfirmation: z.boolean(),
    shipmentUpdates: z.boolean(),
    invoiceReady: z.boolean(),
    marketing: z.boolean(),
    security: z.boolean(),
});

export const inAppNotificationPreferencesSchema = z.object({
    auctionResults: z.boolean(),
    outbid: z.boolean(),
    orderConfirmation: z.boolean(),
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
