import type { Metadata } from "next";

// The page is a client component and cannot export `metadata` itself. The
// title is the page's own heading (`marketing.*.title`), set into the root
// layout's `%s · EXPEDITOP` template.
export const metadata: Metadata = { title: "Conditions générales d'utilisation" };

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
