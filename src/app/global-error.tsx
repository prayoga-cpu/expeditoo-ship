"use client";

import { useEffect, useState } from "react";

/**
 * Last-resort boundary: catches a crash in the root layout itself, which
 * `error.tsx` cannot (it renders *inside* that layout). Deliberately
 * dependency-free — no i18n, no design-system components — since whatever
 * broke the layout may have broken the providers those rely on too — so the
 * two sentences are written out here in both languages, and the visitor's
 * browser picks one, rather than going through next-intl.
 */
const COPY = {
  fr: { message: "Une erreur est survenue.", retry: "Réessayer" },
  en: { message: "Something went wrong.", retry: "Try again" },
} as const;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // French first (the product's primary language), switched on the client so
  // the server's markup and the first client render agree.
  const [lang, setLang] = useState<"fr" | "en">("fr");

  useEffect(() => {
    console.error("[app] unhandled root layout error", error);
    setLang(navigator.language?.toLowerCase().startsWith("en") ? "en" : "fr");
  }, [error]);

  const copy = COPY[lang];

  return (
    <html lang={lang}>
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div>
          <p style={{ fontSize: "1rem", marginBottom: "1rem" }}>
            {copy.message}
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            {copy.retry}
          </button>
        </div>
      </body>
    </html>
  );
}
