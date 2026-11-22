import { Suspense } from "react";
import { AddressForm } from "@/features/app/profile/ui/AddressForm";
import { PageLoader } from "@/components/ui/page-loader";

export default function CreateAddressPage() {
  return (
    <div className="w-full mx-auto p-6 pb-24 md:pb-6">
      <Suspense fallback={<PageLoader />}>
        <AddressForm />
      </Suspense>
    </div>
  );
}
