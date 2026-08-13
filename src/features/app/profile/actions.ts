"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { updatePreferences } from "@/server/services/user.service";
import { revalidatePath } from "next/cache";
import { UserPreferences } from "@/db/schema";

/**
 * Server Action to update user preferences (e.g. notifications)
 */
export async function updateUserPreferencesAction(
    updates: Partial<UserPreferences>
) {
    // 1. Get session (server-side check)
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session || !session.user) {
        throw new Error("Unauthorized: You must be logged in to modify settings.");
    }

    try {
        // 2. Call service to merge and update preferences
        await updatePreferences(session.user.id, updates);

        // 3. Revalidate profile page to reflect changes immediately
        revalidatePath("/profile");
        revalidatePath("/account");

        return { success: true };
    } catch (error) {
        console.error("Failed to update preferences:", error);
        return { success: false, error: "Failed to update settings" };
    }
}
