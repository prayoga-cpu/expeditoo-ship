import type { Metadata } from "next";

// The page is a client component and cannot export `metadata` itself. The
// title is the page's own heading (`marketing.*.title`), set into the root
// layout's `%s · EXPEDITOP` template.
export const metadata: Metadata = { title: "Politique de confidentialité" };

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
