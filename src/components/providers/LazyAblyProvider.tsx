"use client";

import dynamic from "next/dynamic";
import React from "react";

const AblyProviderInternal = dynamic(
  () => import("./AblyProvider").then((mod) => mod.AblyProvider),
  { 
    ssr: false,
    loading: () => null // Render nothing while loading
  }
);

export function LazyAblyProvider({ children }: { children: React.ReactNode }) {
  return <AblyProviderInternal>{children}</AblyProviderInternal>;
}
