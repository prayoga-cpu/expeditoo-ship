"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { LANDING_VIDEO } from "./landing-images";
import styles from "./landing.module.css";

type NetworkNavigator = Navigator & { connection?: { saveData?: boolean } };

/**
 * Whether this visitor gets moving pictures: not under reduced motion, and
 * not when the browser asks to save data. Read once, after mount — the
 * server cannot know either, so it always sends the poster alone.
 */
function mayPlay(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return (navigator as NetworkNavigator).connection?.saveData !== true;
}

/** Plays only while the hero is on screen; a hidden loop is wasted work. */
function usePauseOffscreen(video: HTMLVideoElement | null) {
  useEffect(() => {
    if (!video || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void video.play().catch(() => undefined);
      else video.pause();
    });
    observer.observe(video);
    return () => observer.disconnect();
  }, [video]);
}

/**
 * The hero's full-bleed background (landing_2026_11_spec.md §2.2).
 *
 * The poster is a real `<img>` rendered on the server with high priority, so
 * the first paint is never blank and it is the LCP candidate, not a video
 * frame. The `<video>` is added only after mount and only when `mayPlay()`;
 * it fades in over the poster once it actually plays. Both are decoration,
 * hidden from assistive technology.
 */
export function LandingHeroVideo() {
  const [enabled, setEnabled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  useEffect(() => setEnabled(mayPlay()), []);
  usePauseOffscreen(video);

  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden bg-[#0a2a5e]">
      <Image
        src={LANDING_VIDEO.poster}
        width={LANDING_VIDEO.width}
        height={LANDING_VIDEO.height}
        alt=""
        priority
        sizes="100vw"
        className="absolute inset-0 h-full w-full object-cover object-[center_70%]"
      />
      {enabled && (
        <video
          ref={setVideo}
          className={`${styles.video} absolute inset-0 h-full w-full object-cover object-[center_70%]`}
          data-playing={playing}
          poster={LANDING_VIDEO.poster}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          aria-hidden
          onPlaying={() => setPlaying(true)}
        >
          <source src={LANDING_VIDEO.webm} type="video/webm" />
          <source src={LANDING_VIDEO.mp4} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
