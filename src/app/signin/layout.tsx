import type { Metadata } from "next";

// The page is a client component and cannot export `metadata` itself.
export const metadata: Metadata = { title: "Connexion" };

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
