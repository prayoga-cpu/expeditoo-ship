import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/db";
import { DriverLayout } from "@/features/app/driver/ui";

// Runs are executed by both kinds of driver: the in-house `driver`, and the
// outside `carrier`, who reaches their deliveries here too (driver_types_spec.md §6).
async function isDriver(userId: string) {
  const role = await db.query.userRoles.findFirst({
    where: (roles, { and, eq, inArray }) =>
      and(eq(roles.userId, userId), inArray(roles.role, ["driver", "carrier"])),
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
