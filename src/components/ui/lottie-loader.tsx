"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

/** Light and dark cuts of the same animation. */
const LIGHT_SRC = "/animations/loader.lottie";
const DARK_SRC = "/animations/loader-dark.lottie";

interface LottieLoaderProps {
    /**
     * Overrides the theme-matched default. Only pass this for a genuinely
     * different animation — the loader picks its own light/dark cut.
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
 * Reusable Lottie animation loader.
 *
 * The disc behind the truck is baked into the animation, so a single asset
 * cannot serve both themes — it rendered as a white badge on the dark
 * background. Two cuts are shipped instead and picked at runtime.
 *
 * `resolvedTheme`, not `theme`: the app's default is `system`, and `theme`
 * reports the literal string "system" rather than what is actually on screen.
 *
 * The container renders immediately but the animation waits for mount. On the
 * server there is no theme to resolve, so mounting straight away would render
 * the light cut and swap it a frame later — a white flash on every dark-mode
 * page load. Reserving the box keeps the layout from shifting meanwhile.
 */
export function LottieLoader({
    src,
    width = 120,
    height = 120,
    loop = true,
    autoplay = true,
    speed = 1,
    className = "",
}: LottieLoaderProps) {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const resolvedSrc =
        src ?? (resolvedTheme === "dark" ? DARK_SRC : LIGHT_SRC);

    return (
        <div
            className={`flex items-center justify-center ${className}`}
            style={{ width, height }}
        >
            {mounted && (
                <DotLottieReact
                    // Remounts on theme change; DotLottie does not reload a
                    // swapped `src` on its own.
                    key={resolvedSrc}
                    src={resolvedSrc}
                    loop={loop}
                    autoplay={autoplay}
                    speed={speed}
                    style={{ width: "100%", height: "100%" }}
                />
            )}
        </div>
    );
}
