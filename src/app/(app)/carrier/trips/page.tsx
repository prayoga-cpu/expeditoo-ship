import { Suspense } from "react";
import { CarrierTripsScreen } from "@/features/app/carrier/ui";
import { PageLoader } from "@/components/ui/page-loader";

export default function CarrierTripsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <CarrierTripsScreen />
    </Suspense>
  );
}
