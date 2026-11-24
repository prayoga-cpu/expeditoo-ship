"use client";

import * as React from "react";
import {
  ThemeProvider as NextThemesProvider,
  useTheme,
  type ThemeProviderProps,
} from "next-themes";

import { migrateStoredTheme, syncColorSchemeMeta } from "@/lib/theme";

// Before React renders anything, so `next-themes` reads `light` rather than a
// leftover `system` (2.96.0 #29). Module scope runs once, when the client
// bundle loads; on the server there is no storage and it does nothing.
if (typeof window !== "undefined") migrateStoredTheme();

/** `<meta name="color-scheme">` follows the app's own choice, on every toggle. */
function ColorSchemeMeta() {
  const { resolvedTheme } = useTheme();
  React.useEffect(() => {
    syncColorSchemeMeta(resolvedTheme);
  }, [resolvedTheme]);
  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ColorSchemeMeta />
      {children}
    </NextThemesProvider>
  );
}
