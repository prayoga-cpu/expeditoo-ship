"use client";

// Kept as an alias only: both import paths must reach the toaster that is
// actually mounted (see src/hooks/use-toast.ts). A second, independent copy of
// the hook is how one of them ended up silently rendering nothing.
export { useToast, toast } from "@/hooks/use-toast";
