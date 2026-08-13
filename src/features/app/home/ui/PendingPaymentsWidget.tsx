"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CreditCard, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

// Mock data for pending payments
const pendingPayments = [
    { id: "ord_1", title: "Vintage Lamp", amount: 85, dueDate: "2024-12-25" },
    { id: "ord_2", title: "Leather Bag", amount: 120, dueDate: "2024-12-26" },
];

export function PendingPaymentsWidget() {
    const t = useTranslations("home.widgets");

    const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
    const count = pendingPayments.length;

    if (count === 0) return null;

    return (
        <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                                {t("pendingPayments")}
                            </h3>
                            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                                €{totalPending}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            {t("pendingCount", { count })}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {pendingPayments.slice(0, 2).map((payment) => (
                                <Link key={payment.id} href={`/checkout/${payment.id}`}>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 bg-background/50 hover:bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                                    >
                                        <CreditCard className="h-3 w-3 mr-1" />
                                        {payment.title} - €{payment.amount}
                                    </Button>
                                </Link>
                            ))}
                            {count > 2 && (
                                <Link href="/notifications?tab=payments">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-amber-600 dark:text-amber-400"
                                    >
                                        +{count - 2} {t("more")}
                                        <ArrowRight className="h-3 w-3 ml-1" />
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
