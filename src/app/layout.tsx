import type React from "react";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { PWAInstall } from "@/components/pwa/PWAInstall";
import { defaultLocale } from "@/i18n/config";

const font = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});
const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});
// Landing surface only — the app UI stays on Plus Jakarta Sans.
const fontGeist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EXPEDITOO - Transport Marketplace",
  description: "Post a transport job, compare carrier offers, track delivery",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Expeditoo",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0052FF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // `lang` is `defaultLocale`, not a hardcoded "en": the server renders French
  // copy (src/i18n/request.ts), so advertising English mislabelled every SSR
  // response to screen readers and translation tooling. LocaleProvider corrects
  // it on the client once the device language resolves.
  return (
    <html lang={defaultLocale} suppressHydrationWarning>
      {/* Extensions such as Grammarly stamp their own attributes onto <body>
          before React hydrates, which reads as a mismatch. suppressHydration-
          Warning applies only to the element carrying it, so <html>'s copy —
          there for next-themes, which writes the theme class onto <html> —
          does not cover this. */}
      <body
        suppressHydrationWarning
        className={`${font.variable} ${fontGeist.variable} ${fontMono.variable} font-sans antialiased`}
      >
        <Providers>
          {children}
          <PWAInstall />
        </Providers>
      </body>
    </html>
  );
}
