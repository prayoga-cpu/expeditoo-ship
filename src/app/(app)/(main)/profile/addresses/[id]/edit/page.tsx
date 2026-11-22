import { Suspense } from "react";
import { AddressForm } from "@/features/app/profile/ui/AddressForm";
import { PageLoader } from "@/components/ui/page-loader";

interface EditAddressPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAddressPage({
  params,
}: EditAddressPageProps) {
  const { id } = await params;

  return (
    <div className="w-full mx-auto p-6 pb-24 md:pb-6">
      <Suspense fallback={<PageLoader />}>
        <AddressForm addressId={id} />
      </Suspense>
    </div>
  );
}
