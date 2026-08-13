"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { use } from "react";
import { CheckCircle, Package, FileText, ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageLoader } from "@/components/ui/page-loader";

interface PageProps {
    params: Promise<{
        id: string; // This is the auctionId / listingId
    }>;
}

export default function PaymentSuccessPage({ params }: PageProps) {
    const { id } = use(params);

    // Fetch real order data to get context (Shipment ID, Invoice ID, etc.)
    const { data: order, isLoading } = useQuery({
        queryKey: ["order", "listing", id],
        queryFn: async () => {
            const res = await fetch(`/api/orders/listing/${id}`);
            if (!res.ok) throw new Error("Failed to fetch order details");
            const json = await res.json();
            return json.data;
        },
        enabled: !!id,
        retry: 1,
    });

    if (isLoading) {
        return <PageLoader />;
    }

    // Fallback if order not found (shouldn't happen if redirected correctly)
    if (!order) {
        return (
            <div className="max-w-md mx-auto p-6 text-center pt-20">
                <h1 className="text-xl font-bold mb-4">Processing Order...</h1>
                <p className="text-muted-foreground mb-4">
                    We couldn't retrieve the order details just yet. It might still be processing.
                </p>
                <Link href="/home">
                    <Button>Go to Dashboard</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto p-6 text-center pt-20 animate-in fade-in zoom-in duration-300">
            {/* Success Icon */}
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>

            <h1 className="text-2xl md:text-3xl font-bold mb-2 text-foreground">
                Payment Successful!
            </h1>

            <p className="text-muted-foreground mb-8">
                Your payment has been confirmed. You can now track your shipment or download your invoice.
            </p>

            {/* Order Summary Card */}
            <div className="bg-muted/30 rounded-xl p-6 mb-8 border border-border/50 text-left">
                <div className="flex justify-between items-center mb-4 border-b border-border/50 pb-4">
                    <span className="text-sm font-medium text-muted-foreground">ORDER REF</span>
                    <span className="font-mono bg-background px-2 py-1 rounded text-sm">
                        #{order.id?.slice(0, 8).toUpperCase() || id}
                    </span>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Item</span>
                        <span className="font-medium truncate max-w-[200px]">{order.listing?.title}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Paid</span>
                        <span className="font-bold text-primary">
                            ${((order.totalPrice || 0) / 100).toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
                {/* Track Shipment Button - PRIMARY ACTION */}
                {order.shipment?.id ? (
                    <Link href={`/deliveries/${order.shipment.id}`} className="block w-full">
                        <Button className="w-full h-14 rounded-full text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                            <Package className="mr-2 h-5 w-5" />
                            Track Shipment
                        </Button>
                    </Link>
                ) : (
                    <div className="p-3 bg-yellow-50 text-yellow-700 rounded-lg text-sm mb-2">
                        Shipment is being prepared...
                    </div>
                )}

                {/* Invoice Logic */}
                {/* Note: Assuming invoice endpoint exists or we use a placeholder handler */}
                <Button
                    variant="outline"
                    className="w-full h-12 rounded-full border-2 hover:bg-muted/50"
                    onClick={() => {
                        // Future: direct link to PDF
                        alert("Invoice download starting...");
                    }}
                >
                    <FileText className="mr-2 h-4 w-4" />
                    Download Invoice
                </Button>

                <Link href="/home" className="block w-full">
                    <Button variant="ghost" className="w-full h-12 rounded-full text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Return to Dashboard
                    </Button>
                </Link>
            </div>
        </div>
    );
}
