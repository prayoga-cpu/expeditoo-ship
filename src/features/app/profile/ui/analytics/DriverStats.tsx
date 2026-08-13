"use client";

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, Clock, TrendingUp, Star, Euro } from "lucide-react";
import { useTranslations } from "next-intl";

// Mock data for driver statistics
const earningsData = [
    { week: "W1", earnings: 320 },
    { week: "W2", earnings: 450 },
    { week: "W3", earnings: 380 },
    { week: "W4", earnings: 520 },
];

const deliveryStats = {
    totalDeliveries: 156,
    totalDistance: 2847,
    avgDeliveryTime: 45, // minutes
    rating: 4.8,
    totalEarnings: 4850,
};

const recentDeliveries = [
    { id: "1", route: "Paris → Lyon", distance: 465, earned: 85, date: "2024-12-20" },
    { id: "2", route: "Marseille → Nice", distance: 198, earned: 45, date: "2024-12-19" },
    { id: "3", route: "Bordeaux → Toulouse", distance: 243, earned: 52, date: "2024-12-18" },
];

export function DriverStats() {
    const t = useTranslations("profile.analytics");

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Euro className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            <p className="text-xs text-muted-foreground">{t("totalEarnings")}</p>
                        </div>
                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                            €{deliveryStats.totalEarnings.toLocaleString()}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Truck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <p className="text-xs text-muted-foreground">{t("deliveries")}</p>
                        </div>
                        <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                            {deliveryStats.totalDeliveries}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <p className="text-xs text-muted-foreground">{t("totalDistance")}</p>
                        </div>
                        <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                            {deliveryStats.totalDistance.toLocaleString()} km
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <p className="text-xs text-muted-foreground">{t("avgTime")}</p>
                        </div>
                        <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                            {deliveryStats.avgDeliveryTime} min
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Star className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                            <p className="text-xs text-muted-foreground">{t("rating")}</p>
                        </div>
                        <p className="text-xl font-bold text-rose-600 dark:text-rose-400">
                            {deliveryStats.rating}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Earnings Chart */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        {t("weeklyEarnings")}
                        <Badge variant="secondary" className="text-xs font-normal">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            +15.2%
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={earningsData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="week" className="text-xs" />
                                <YAxis className="text-xs" tickFormatter={(v) => `€${v}`} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--popover))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "8px",
                                    }}
                                    formatter={(value: number) => [`€${value}`, t("earnings")]}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="earnings"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={3}
                                    dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Recent Deliveries */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">{t("recentDeliveries")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {recentDeliveries.map((delivery) => (
                            <div
                                key={delivery.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Truck className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{delivery.route}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {delivery.distance} km • {delivery.date}
                                        </p>
                                    </div>
                                </div>
                                <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    +€{delivery.earned}
                                </p>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
