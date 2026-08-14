import type React from "react";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { PWAInstall } from "@/components/pwa/PWAInstall";

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
  return (
    <html lang="en" suppressHydrationWarning>
      <body
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
