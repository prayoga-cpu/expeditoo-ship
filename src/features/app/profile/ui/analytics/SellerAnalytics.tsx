"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Package, Euro, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";

// Mock data for seller analytics
const revenueData = [
    { month: "Jan", revenue: 1200 },
    { month: "Feb", revenue: 1800 },
    { month: "Mar", revenue: 2400 },
    { month: "Apr", revenue: 1900 },
    { month: "May", revenue: 3200 },
    { month: "Jun", revenue: 2800 },
];

const topItems = [
    { id: "1", title: "Vintage Chair", sales: 12, revenue: 1440 },
    { id: "2", title: "Antique Lamp", sales: 8, revenue: 960 },
    { id: "3", title: "Art Deco Mirror", sales: 6, revenue: 1200 },
];

export function SellerAnalytics() {
    const t = useTranslations("profile.analytics");

    const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);
    const totalSales = topItems.reduce((sum, item) => sum + item.sales, 0);
    const averageOrderValue = Math.round(totalRevenue / totalSales);

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{t("totalRevenue")}</p>
                                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                    €{totalRevenue.toLocaleString()}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <Euro className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <TrendingUp className="h-3 w-3" />
                            <span>+12.5% {t("fromLastMonth")}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{t("totalSales")}</p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {totalSales}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <ShoppingBag className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                            <TrendingUp className="h-3 w-3" />
                            <span>+8.2% {t("fromLastMonth")}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">{t("avgOrderValue")}</p>
                                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                    €{averageOrderValue}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                                <Package className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                            <TrendingUp className="h-3 w-3" />
                            <span>+5.1% {t("fromLastMonth")}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Revenue Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{t("revenueOverTime")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueData}>
                                <defs>
                                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="month" className="text-xs" />
                                <YAxis className="text-xs" tickFormatter={(v) => `€${v}`} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--popover))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "8px",
                                    }}
                                    formatter={(value: number) => [`€${value}`, t("revenue")]}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    fill="url(#revenueGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Top Items */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{t("topSellingItems")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {topItems.map((item, index) => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                            >
                                <div className="flex items-center gap-3">
                                    <Badge variant="secondary" className="w-7 h-7 rounded-full flex items-center justify-center">
                                        #{index + 1}
                                    </Badge>
                                    <div>
                                        <p className="font-medium">{item.title}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {item.sales} {t("sales")}
                                        </p>
                                    </div>
                                </div>
                                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    €{item.revenue}
                                </p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
