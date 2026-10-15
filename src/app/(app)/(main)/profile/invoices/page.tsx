import { Suspense } from "react";
import { PageLoader } from "@/components/ui/page-loader";
import { TransactionHistory } from "@/features/app/profile/ui/invoices";

/**
 * « Historique des transactions ». The path predates the name and stays:
 * every receipt already emailed links here.
 *
 * `Suspense` is load-bearing: the screen holds its tab in the URL and so reads
 * `useSearchParams`, which builds without one and then fails `next build`.
 */
export default function InvoicesPage() {
    return (
        <div className="container max-w-4xl mx-auto py-6 px-4">
            <Suspense fallback={<PageLoader />}>
                <TransactionHistory />
            </Suspense>
        </div>
    );
}
