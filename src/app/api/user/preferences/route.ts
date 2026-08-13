import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getUserById, updateUser } from "@/server/dal/users.dal";
import { updatePreferencesSchema } from "@/server/dto/preferences.dto";
import { defaultPreferences, type UserPreferences } from "@/db/schema/users";

/**
 * GET /api/user/preferences
 * Get current user's notification preferences
 */
export async function GET() {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Unauthorized" },
                },
                { status: 401 }
            );
        }

        const user = await getUserById(session.user.id);

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: "NOT_FOUND", message: "User not found" },
                },
                { status: 404 }
            );
        }

        // Return preferences with defaults for any missing fields
        const preferences = {
            ...defaultPreferences,
            ...user.preferences,
            notifications: {
                ...defaultPreferences.notifications,
                ...(user.preferences?.notifications || {}),
                email: {
                    ...defaultPreferences.notifications.email,
                    ...(user.preferences?.notifications?.email || {}),
                },
                inApp: {
                    ...defaultPreferences.notifications.inApp,
                    ...(user.preferences?.notifications?.inApp || {}),
                },
            },
        };

        return NextResponse.json({ success: true, data: { preferences } });
    } catch (error) {
        console.error("Error fetching preferences:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to fetch preferences",
                },
            },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/user/preferences
 * Update current user's notification preferences
 */
export async function PATCH(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: "UNAUTHORIZED", message: "Unauthorized" },
                },
                { status: 401 }
            );
        }

        const body = await request.json();
        const validationResult = updatePreferencesSchema.safeParse(body);

        if (!validationResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: "VALIDATION_ERROR",
                        message: "Invalid input",
                        details: validationResult.error.flatten(),
                    },
                },
                { status: 400 }
            );
        }

        const user = await getUserById(session.user.id);

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    error: { code: "NOT_FOUND", message: "User not found" },
                },
                { status: 404 }
            );
        }

        // Deep merge preferences
        const currentPreferences = user.preferences || defaultPreferences;
        const updates = validationResult.data;

        const newPreferences: UserPreferences = {
            notifications: {
                email: {
                    ...currentPreferences.notifications.email,
                    ...(updates.notifications?.email || {}),
                },
                inApp: {
                    ...currentPreferences.notifications.inApp,
                    ...(updates.notifications?.inApp || {}),
                },
            },
        };

        const updatedUser = await updateUser(session.user.id, {
            preferences: newPreferences,
        });

        return NextResponse.json({
            success: true,
            data: { preferences: updatedUser.preferences },
            message: "Preferences updated successfully",
        });
    } catch (error) {
        console.error("Error updating preferences:", error);
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "INTERNAL_SERVER_ERROR",
                    message: "Failed to update preferences",
                },
            },
            { status: 500 }
        );
    }
}
