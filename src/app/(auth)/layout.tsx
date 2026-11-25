import type { Metadata } from "next";

// The pages under here are client components and cannot export `metadata`.
// One title for the group, set into the root layout's `%s · EXPEDITOP`.
export const metadata: Metadata = { title: "Votre compte" };

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
