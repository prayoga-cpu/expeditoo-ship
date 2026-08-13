"use client";

import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ActiveConversationProvider } from "@/features/app/messages/context";
import React from "react";

// Dynamically import AblyProvider to avoid SSR issues
import { LazyAblyProvider } from "@/components/providers/LazyAblyProvider";
import { LocaleProvider } from "@/components/providers/LocaleProvider";

// Create a client instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const providers = [
  (children: React.ReactNode) => (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      storageKey="theme"
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
  (children: React.ReactNode) => <ActiveConversationProvider>{children}</ActiveConversationProvider>,
  (children: React.ReactNode) => <LazyAblyProvider>{children}</LazyAblyProvider>,
];

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {providers.reduceRight((acc, ProviderFn) => ProviderFn(acc), children)}
      <Toaster />
    </>
  );
}
