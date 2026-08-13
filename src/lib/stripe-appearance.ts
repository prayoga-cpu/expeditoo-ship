import type { Appearance } from "@stripe/stripe-js";

/**
 * Get Stripe Elements appearance configuration based on current theme
 * Matches the app's dark/light mode styling
 */
export function getStripeAppearance(theme: string | undefined): Appearance {
  const isDark = theme === "dark";

  return {
    theme: isDark ? "night" : "stripe",
    variables: {
      colorPrimary: "#3b82f6", // blue-500
      colorBackground: isDark ? "#0a0a0a" : "#ffffff",
      colorText: isDark ? "#fafafa" : "#09090b",
      colorDanger: "#ef4444",
      fontFamily: "Inter, system-ui, sans-serif",
      spacingUnit: "4px",
      borderRadius: "8px",
      colorTextSecondary: isDark ? "#a1a1aa" : "#71717a",
      colorTextPlaceholder: isDark ? "#52525b" : "#a1a1aa",
    },
    rules: {
      ".Input": {
        backgroundColor: isDark ? "#18181b" : "#ffffff",
        border: isDark ? "1px solid #27272a" : "1px solid #e4e4e7",
        boxShadow: "none",
      },
      ".Input:focus": {
        border: "1px solid #3b82f6",
        boxShadow: "0 0 0 1px #3b82f6",
      },
      ".Input:hover": {
        border: isDark ? "1px solid #3f3f46" : "1px solid #d4d4d8",
      },
      ".Label": {
        color: isDark ? "#fafafa" : "#09090b",
        fontWeight: "500",
      },
      ".Tab": {
        backgroundColor: isDark ? "#18181b" : "#f4f4f5",
        border: isDark ? "1px solid #27272a" : "1px solid #e4e4e7",
      },
      ".Tab:hover": {
        backgroundColor: isDark ? "#27272a" : "#e4e4e7",
      },
      ".Tab--selected": {
        backgroundColor: isDark ? "#27272a" : "#ffffff",
        border: "1px solid #3b82f6",
      },
      ".Block": {
        backgroundColor: isDark ? "#18181b" : "#ffffff",
        border: isDark ? "1px solid #27272a" : "1px solid #e4e4e7",
      },
    },
  };
}
