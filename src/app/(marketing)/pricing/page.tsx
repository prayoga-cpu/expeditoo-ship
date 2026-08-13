import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Info } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function PricingPage() {
    const t = useTranslations("marketing.pricing");

    return (
        <div className="container mx-auto py-16 px-4 md:px-6">
            <div className="text-center space-y-4 mb-16">
                <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">
                    {t("title")}
                </h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                    {t("subtitle")}
                </p>
                <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 py-2 px-4 rounded-full w-fit mx-auto mt-4">
                    <Info className="w-4 h-4" />
                    <span className="text-sm font-medium">{t("disclaimer")}</span>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                {/* Sellers / Auction Section */}
                <div className="space-y-6">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2">{t("sellers.title")}</h2>
                        <p className="text-muted-foreground">{t("sellers.subtitle")}</p>
                    </div>

                    <Card className="border-2 hover:border-primary/50 transition-colors relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-3 bg-primary/10 rounded-bl-xl">
                            <span className="text-xs font-bold text-primary px-2">{t("sellers.mostPopular")}</span>
                        </div>
                        <CardHeader>
                            <CardTitle className="text-2xl">{t("sellers.planTitle")}</CardTitle>
                            <CardDescription>{t("sellers.planDesc")}</CardDescription>
                            <div className="mt-4 flex items-baseline text-5xl font-extrabold">
                                {t("sellers.price")}<span className="text-xl font-normal text-muted-foreground ml-2">{t("sellers.priceUnit")}</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    <span>{t("sellers.features.unlimited")}</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    <span>{t("sellers.features.auction")}</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    <span>{t("sellers.features.support")}</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    <span>{t("sellers.features.payments")}</span>
                                </li>
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Link href="/create" className="w-full">
                                <Button className="w-full">{t("sellers.cta")}</Button>
                            </Link>
                        </CardFooter>
                    </Card>
                </div>

                {/* Drivers Section */}
                <div className="space-y-6">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-2">{t("drivers.title")}</h2>
                        <p className="text-muted-foreground">{t("drivers.subtitle")}</p>
                    </div>

                    <Card className="border-2 hover:border-primary/50 transition-colors">
                        <CardHeader>
                            <CardTitle className="text-2xl">{t("drivers.planTitle")}</CardTitle>
                            <CardDescription>{t("drivers.planDesc")}</CardDescription>
                            <div className="mt-4 flex items-baseline text-5xl font-extrabold">
                                {t("drivers.price")}<span className="text-xl font-normal text-muted-foreground ml-2">{t("drivers.priceUnit")}</span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    <span>{t("drivers.features.allRequests")}</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    <span>{t("drivers.features.tools")}</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    <span>{t("drivers.features.payout")}</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Check className="w-4 h-4 text-green-500" />
                                    <span>{t("drivers.features.badge")}</span>
                                </li>
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Link href="/signup?role=driver" className="w-full">
                                <Button variant="outline" className="w-full">{t("drivers.cta")}</Button>
                            </Link>
                        </CardFooter>
                    </Card>
                </div>
            </div>

            {/* Detailed Table Placeholder */}
            <div className="mt-20 max-w-4xl mx-auto">
                <h3 className="text-xl font-bold mb-6 text-center">{t("detailed.title")}</h3>
                <div className="rounded-lg border overflow-hidden">
                    <div className="grid grid-cols-3 bg-muted p-4 font-medium text-sm">
                        <div>{t("detailed.headers.feature")}</div>
                        <div className="text-center">{t("detailed.headers.saver")}</div>
                        <div className="text-center">{t("detailed.headers.priority")}</div>
                    </div>
                    <div className="divide-y">
                        {[
                            "duration",
                            "photos",
                            "cap",
                            "highlighting"
                        ].map((key) => (
                            <div key={key} className="grid grid-cols-3 p-4 text-sm hover:bg-muted/50 transition-colors">
                                <div className="font-medium">{t(`detailed.rows.${key}.name`)}</div>
                                <div className="text-center text-muted-foreground">{t(`detailed.rows.${key}.col1`)}</div>
                                <div className="text-center text-muted-foreground">{t(`detailed.rows.${key}.col2`)}</div>
                            </div>
                        ))}
                    </div>
                </div>
                <p className="text-center text-sm text-muted-foreground mt-4 italic">
                    {t("detailed.footer")}
                </p>
            </div>
        </div>
    );
}
