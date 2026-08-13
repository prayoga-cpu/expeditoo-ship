"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, CreditCard, Package, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

// Mock data for buyer purchase history
const spendingData = [
    { month: "Jan", spending: 450 },
    { month: "Feb", spending: 680 },
    { month: "Mar", spending: 320 },
    { month: "Apr", spending: 890 },
    { month: "May", spending: 560 },
    { month: "Jun", spending: 720 },
];

const recentPurchases = [
    { id: "1", title: "Vintage Desk Lamp", price: 85, date: "2024-12-20", status: "delivered" },
    { id: "2", title: "Leather Messenger Bag", price: 120, date: "2024-12-18", status: "shipped" },
    { id: "3", title: "Antique Clock", price: 250, date: "2024-12-15", status: "delivered" },
    { id: "4", title: "Art Print Collection", price: 75, date: "2024-12-10", status: "delivered" },
];

const statusColors: Record<string, string> = {
    delivered: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    shipped: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

export function BuyerPurchaseHistory() {
    const t = useTranslations("profile.analytics");

    const totalSpent = spendingData.reduce((sum, d) => sum + d.spending, 0);
    const totalOrders = recentPurchases.length;
    const avgOrderValue = Math.round(totalSpent / totalOrders);

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{t("totalSpent")}</p>
                                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                    €{totalSpent.toLocaleString()}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                                <CreditCard className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <TrendingUp className="h-3 w-3" />
                            <span>+18.3% {t("fromLastMonth")}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{t("totalOrders")}</p>
                                <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                                    {totalOrders}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                                <ShoppingCart className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400">
                            <TrendingUp className="h-3 w-3" />
                            <span>+3 {t("thisMonth")}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{t("avgOrderValue")}</p>
                                <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                                    €{avgOrderValue}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-rose-500/20 flex items-center justify-center">
                                <Package className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Spending Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{t("spendingOverTime")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={spendingData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="month" className="text-xs" />
                                <YAxis className="text-xs" tickFormatter={(v) => `€${v}`} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--popover))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "8px",
                                    }}
                                    formatter={(value: number) => [`€${value}`, t("spending")]}
                                />
                                <Bar
                                    dataKey="spending"
                                    fill="hsl(var(--primary))"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Recent Purchases */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{t("recentPurchases")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {recentPurchases.map((purchase) => (
                            <div
                                key={purchase.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                            >
                                <div className="flex-1">
                                    <p className="font-medium">{purchase.title}</p>
                                    <p className="text-sm text-muted-foreground">{purchase.date}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge variant="outline" className={statusColors[purchase.status]}>
                                        {t(`status.${purchase.status}`)}
                                    </Badge>
                                    <p className="font-semibold">€{purchase.price}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
