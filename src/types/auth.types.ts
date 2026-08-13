/**
 * Auth Types for Expeditoo
 * Provides proper typing for better-auth callbacks
 */

import type { NextRequest } from "next/server";

// User object passed to email callbacks
export interface EmailVerificationUser {
    id: string;
    email: string;
    name?: string | null;
    emailVerified?: boolean;
    image?: string | null;
}

// Parameters for email verification callback
export interface EmailVerificationParams {
    user: EmailVerificationUser;
    url: string;
    token: string;
}

// Parameters for password reset callback
export interface PasswordResetParams {
    user: EmailVerificationUser;
    url: string;
}

// Request type for email callbacks (can be undefined in some contexts)
export type EmailCallbackRequest = NextRequest | Request | undefined;
