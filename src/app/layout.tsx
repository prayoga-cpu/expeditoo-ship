import type React from "react";
import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";
import { PWAInstall } from "@/components/pwa/PWAInstall";
import { EnvBadge } from "@/components/EnvBadge";
import { getRequestLocale } from "@/i18n/request-locale";

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
  // French: the server renders French first (`<html lang>` below), and a tab
  // title is read before any toggle is. `template` is what a page's own
  // `title` is set into; a page that wants the whole line uses `absolute`.
  title: {
    default: "EXPEDITOP — Faites transporter vos objets en France et à l'étranger",
    template: "%s · EXPEDITOP",
  },
  description:
    "Publiez une demande de transport, comparez les offres des transporteurs, choisissez et suivez la livraison.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Expeditop",
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
  // `<meta name="color-scheme" content="only light">`: no browser darkens the
  // page on its own before the stylesheet arrives (2.96.0 #29). Choosing Dark
  // in the app rewrites it (ThemeProvider → src/lib/theme.ts).
  colorScheme: "only light",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The language is settled on the server, before the first byte: the
  // visitor's own choice (cookie), else what their device asks for
  // (`Accept-Language`), else French. `lang` and the rendered copy therefore
  // agree from the first paint, with no French flash on an English device
  // (docs/specs/first_paint_language_spec.md).
  const locale = await getRequestLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      {/* Extensions such as Grammarly stamp their own attributes onto <body>
          before React hydrates, which reads as a mismatch. suppressHydration-
          Warning applies only to the element carrying it, so <html>'s copy —
          there for next-themes, which writes the theme class onto <html> —
          does not cover this. */}
      <body
        suppressHydrationWarning
        className={`${font.variable} ${fontGeist.variable} ${fontMono.variable} font-sans antialiased`}
      >
        <EnvBadge />
        <Providers locale={locale}>
          {children}
          <PWAInstall />
        </Providers>
      </body>
    </html>
  );
}
