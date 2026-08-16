import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { MainLayout } from "@/components/layouts/MainLayout";

/**
 * The carrier segment lives outside `(main)` but wears the same chrome, so
 * /carrier/* pages get the sidebar, header and bottom nav like the rest of
 * the app (mirrors `(main)/layout.tsx`).
 *
 * Guards on a session, not on the `carrier` role. /carrier/application is where
 * someone *becomes* a carrier, so a role check here would lock out precisely
 * the people the screen exists for. The role-sensitive routes underneath —
 * offers and vehicles — are enforced server-side by `requireOwnCarrier` in
 * carrier.service, which answers on ownership rather than on reachability.
 */
export default async function CarrierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/signin?callbackUrl=/carrier/application");
  }

  return <MainLayout>{children}</MainLayout>;
}
