"use client";

import type { ReactNode } from "react";
import { toast as sonner } from "sonner";

/**
 * The shadcn `useToast` API, backed by sonner.
 *
 * It used to be the shadcn/radix implementation, which pushes onto its own
 * store and renders through `<Toaster />` from `components/ui/toaster` -- and
 * that component is mounted nowhere. Providers mounts sonner's Toaster
 * instead, so every `toast()` call through this hook went into a store nothing
 * read: no success confirmations, and, worse, no error messages. A failing
 * admin action looked exactly like one that did nothing at all.
 *
 * Rather than rewrite every call site, the hook now delegates to the toaster
 * that is actually on screen. The `{ title, description, variant }` shape is
 * unchanged, so callers did not move.
 */

interface ToastOptions {
  title?: ReactNode;
  description?: ReactNode;
  variant?: "default" | "destructive" | null;
}

function toast({ title, description, variant }: ToastOptions) {
  // sonner takes one message plus an optional description; shadcn callers pass
  // either or both.
  const message = title ?? description ?? "";
  const options = title && description ? { description } : undefined;

  return variant === "destructive"
    ? sonner.error(message, options)
    : sonner(message, options);
}

function useToast() {
  return { toast, dismiss: sonner.dismiss };
}

export { useToast, toast };
