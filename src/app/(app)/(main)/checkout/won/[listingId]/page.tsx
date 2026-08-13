import { WonCheckout } from "@/features/app/checkout/ui/WonCheckout";

interface PageProps {
  params: Promise<{ listingId: string }>;
}

export default async function WonCheckoutPage({ params }: PageProps) {
  const { listingId } = await params;

  return <WonCheckout listingId={listingId} />;
}
