import { DriverApplicationForm } from "@/features/app/profile/ui/DriverApplicationForm";
import { ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { driverService } from "@/server/services/driver.service";

export default async function BecomeDriverPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/signin");
  }

  // 1. Check if user is ALREADY a driver (has role)
  const isDriver = await driverService.isUserDriver(session.user.id);

  if (isDriver) {
    redirect("/driver/dashboard");
  }

  // 2. Check for PENDING or APPROVED application (redundant check for robustness)
  const application = await driverService.getUserApplicationStatus(
    session.user.id
  );

  if (application?.status === "APPROVED") {
    redirect("/driver/dashboard");
  }

  if (application?.status === "PENDING") {
    return (
      <div className="p-4 md:p-6 mx-auto w-full">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center">
            <Clock className="w-10 h-10 text-yellow-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Application Pending</h1>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your application to become a driver is currently under review.
              We will notify you once a decision has been made.
            </p>
          </div>
          <Link href="/profile">
            <Button variant="outline">Return to Profile</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 mx-auto w-full">
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Link href="/profile">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Become a Driver</h1>
        </div>
        <p className="text-muted-foreground">
          Apply to become a verified driver and start earning.
        </p>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <DriverApplicationForm />
      </div>
    </div>
  );
}
