import { Checkout } from "@/features/app/checkout/ui/Checkout";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CheckoutPage({ params }: PageProps) {
  const { id } = await params;

  return <Checkout auctionId={id} />;
}
