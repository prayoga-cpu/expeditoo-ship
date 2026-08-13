"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Euro, TrendingUp } from "lucide-react";
import { useDriverShipments } from "../hooks/useDriverShipments";
import { useTranslations } from "next-intl";

export function DriverStats() {
    const t = useTranslations("driver.dashboard.stats");
    const { myShipments } = useDriverShipments();



    const totalDeliveries = myShipments.filter(
        (s) => s.status === "DELIVERED" || s.status === "COMPLETED"
    ).length;

    const totalEarnings =
        myShipments
            .filter((s) => s.status === "DELIVERED" || s.status === "COMPLETED")
            .reduce((acc, curr) => acc + (curr.price || 0), 0) / 100;

    // Calculate success rate (placeholder logic for now)
    // Assuming all completed/delivered are successful
    const completedCount = totalDeliveries;
    const totalAssigned = myShipments.length;
    const successRate =
        totalAssigned > 0 ? Math.round((completedCount / totalAssigned) * 100) : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t("totalDeliveries")}</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalDeliveries}</div>
                    <p className="text-xs text-muted-foreground">{t("completedShipments")}</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t("totalEarnings")}</CardTitle>
                    <Euro className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">€{totalEarnings.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">
                        {t("fromDeliveries")}
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t("successRate")}</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{successRate}%</div>
                    <p className="text-xs text-muted-foreground">
                        {t("basedOnAssignments", { count: totalAssigned })}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
