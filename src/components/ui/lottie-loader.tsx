"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

interface LottieLoaderProps {
    /** 
     * Path to the .lottie file (relative to public folder)
     * @example "/animations/loader.lottie"
     */
    src?: string;
    /** Width of the animation container */
    width?: number | string;
    /** Height of the animation container */
    height?: number | string;
    /** Whether to loop the animation */
    loop?: boolean;
    /** Whether to autoplay */
    autoplay?: boolean;
    /** Playback speed (1 = normal, 2 = 2x speed) */
    speed?: number;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Reusable Lottie Animation Loader
 * 
 * Uses the optimized .lottie format for best performance.
 * Place your .lottie files in the /public/animations/ folder.
 * 
 * @example
 * <LottieLoader src="/animations/loader.lottie" width={120} height={120} />
 */
export function LottieLoader({
    src = "/animations/loader.lottie",
    width = 120,
    height = 120,
    loop = true,
    autoplay = true,
    speed = 1,
    className = "",
}: LottieLoaderProps) {
    return (
        <div
            className={`flex items-center justify-center ${className}`}
            style={{ width, height }}
        >
            <DotLottieReact
                src={src}
                loop={loop}
                autoplay={autoplay}
                speed={speed}
                style={{ width: "100%", height: "100%" }}
            />
        </div>
    );
}
