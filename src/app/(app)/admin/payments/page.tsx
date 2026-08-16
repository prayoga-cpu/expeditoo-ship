"use client";

import { DollarSign } from "lucide-react";
import { PaymentsTable } from "@/features/app/admin/ui/PaymentsTable";
import { useAdminPayments } from "@/features/app/admin/hooks/useAdminPayments";
import { PageLoader } from "@/components/ui/page-loader";
import { useTranslations } from "next-intl";

export default function AdminPaymentsPage() {
    const { data: payments, isLoading, isError, processRefund, isRefunding } = useAdminPayments();
    const t = useTranslations("admin.payments");
    const tCommon = useTranslations("common");

    if (isLoading) {
        return <PageLoader />;
    }

    if (isError) {
        return (
            <div className="text-center py-12">
                <p className="text-destructive">{tCommon("errors.loadFailed")}</p>
            </div>
        );
    }

    return (
        <div className="flex-1 w-full flex flex-col space-y-6">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                    <DollarSign className="w-8 h-8 text-primary" />
                    {t("title")}
                </h1>
                <p className="text-muted-foreground">
                    {t("subtitle")}
                </p>
            </div>

            <PaymentsTable
                payments={payments || []}
                onRefund={(paymentId, reason) => processRefund({ paymentId, reason })}
                isRefunding={isRefunding}
                className="flex-1 min-h-0 flex flex-col"
            />
        </div>
    );
}
