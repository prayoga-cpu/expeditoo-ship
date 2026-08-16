"use client";

import { cn } from "@/lib/utils";
import { LottieLoader } from "./lottie-loader";

interface PageLoaderProps {
    /** Size of the animation */
    size?: "sm" | "md" | "lg";
    /** Additional CSS classes for the container */
    className?: string;
}

const sizeMap = {
    sm: { width: 80, height: 80 },
    md: { width: 120, height: 120 },
    lg: { width: 160, height: 160 },
};

/**
 * Height configurations.
 * 
 * CSS Variables are injected by each Layout component:
 * - --loader-offset-mobile: Mobile height offset (unified: '8rem')
 * - --loader-offset-desktop: Desktop height offset (unified: '7rem')
 * 
 * All layouts now have IDENTICAL structure, so they all use the SAME offset values.
 */
const loaderClass = "min-h-[calc(100vh-var(--loader-offset-mobile,8rem))] xl:min-h-[calc(100vh-var(--loader-offset-desktop,7rem))]";

/**
 * Full-page/section loading component
 * 
 * Provides a consistent loading experience across all pages.
 * Centers the Lottie animation with optional loading message.
 * 
 * Usage in loading.tsx files:
 * ```tsx
 * export default function Loading() {
 *   return <PageLoader />;
 * }
 * ```
 * 
 * Usage in components with loading states:
 * ```tsx
 * if (isLoading) {
 *   return <PageLoader />;
 * }
 * ```
 */
export function PageLoader({
    size = "md",
    className = "",
}: PageLoaderProps) {
    const { width, height } = sizeMap[size];

    return (
        <div
            role="status"
            aria-label="Loading content"
            aria-busy="true"
            className={cn(
                "flex flex-col items-center justify-center w-full",
                loaderClass,
                className
            )}
        >
            <LottieLoader width={width} height={height} />
        </div>
    );
}

/**
 * Inline loading component for smaller sections
 * 
 * Use this for card content, list items, or smaller loading areas.
 */
export function InlineLoader({
    size = "sm",
    className = "",
}: {
    size?: "sm" | "md";
    className?: string;
}) {
    const dimensions = size === "sm" ? 48 : 64;

    return (
        <div className={`flex items-center justify-center py-4 ${className}`}>
            <LottieLoader width={dimensions} height={dimensions} />
        </div>
    );
}
