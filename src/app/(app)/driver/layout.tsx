import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { DriverLayout } from "@/features/app/driver/ui";

// Helper to check driver role
async function isDriver(userId: string) {
  const role = await db.query.userRoles.findFirst({
    where: (roles, { and, eq }) =>
      and(eq(roles.userId, userId), eq(roles.role, "driver")),
  });
  return !!role;
}

export default async function DriverRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/signin");
  }

  const userIsDriver = await isDriver(session.user.id);

  if (!userIsDriver) {
    redirect("/profile");
  }

  return <DriverLayout>{children}</DriverLayout>;
}
