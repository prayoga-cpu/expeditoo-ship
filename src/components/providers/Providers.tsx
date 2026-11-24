"use client";

import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/lib/auth-context";
import { AccessModeProvider } from "@/lib/access-mode-context";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActiveConversationProvider } from "@/features/app/messages/context";
import React from "react";
import { isRefusal } from "@/lib/fetcher";
import { APP_THEMES, DEFAULT_THEME, THEME_STORAGE_KEY } from "@/lib/theme";

// The Ably SDK loads lazily, beside the app rather than around it
import { LazyAblyProvider } from "@/components/providers/LazyAblyProvider";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";

// Create a client instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      // One retry for a dropped connection or a 5xx; none for a refusal, which
      // answers the same every time.
      retry: (failures, error) => !isRefusal(error) && failures < 1,
      refetchOnWindowFocus: false,
    },
  },
});

const providers = [
  (children: React.ReactNode) => (
    <ThemeProvider
      attribute="class"
      // Light unless the person picks Dark in the app (2.96.0 #29): never
      // because the device or the browser is dark, so there is no System.
      defaultTheme={DEFAULT_THEME}
      themes={[...APP_THEMES]}
      enableSystem={false}
      // next-themes would write a plain `color-scheme: light` inline on
      // <html>, which outranks globals.css's `only light` and lets Chrome's
      // forced dark back in. The stylesheet and ThemeProvider's meta own it.
      enableColorScheme={false}
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange={false}
    >
      {children}
    </ThemeProvider>
  ),
  (children: React.ReactNode) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  ),
  (children: React.ReactNode) => <LocaleProvider>{children}</LocaleProvider>,
  (children: React.ReactNode) => <AuthProvider>{children}</AuthProvider>,
  // Needs `useAuth()` (roles), so it sits inside AuthProvider. One shared mode
  // for AccessSwitcher/MainLayout/BottomNav to read and write, rather than
  // three independent copies that only agreed at first mount.
  (children: React.ReactNode) => <AccessModeProvider>{children}</AccessModeProvider>,
  (children: React.ReactNode) => <ActiveConversationProvider>{children}</ActiveConversationProvider>,
  (children: React.ReactNode) => <LazyAblyProvider>{children}</LazyAblyProvider>,
  // Last, so it sits inside AuthProvider and renders over every surface: an
  // admin inside somebody else's session has to be able to see that anywhere.
  (children: React.ReactNode) => (
    <>
      {children}
      <ImpersonationBanner />
    </>
  ),
];

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {providers.reduceRight((acc, ProviderFn) => ProviderFn(acc), children)}
      <Toaster />
    </>
  );
}
