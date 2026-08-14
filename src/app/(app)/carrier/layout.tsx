"use client";

import { MainLayout } from "@/components/layouts/MainLayout";

/**
 * The carrier segment lives outside `(main)` but wears the same chrome, so
 * /carrier/* pages get the sidebar, header and bottom nav like the rest of
 * the app (mirrors `(main)/layout.tsx`).
 */
export default function CarrierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
