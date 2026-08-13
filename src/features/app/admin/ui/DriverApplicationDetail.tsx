"use client";

import { useTranslations } from "next-intl";

import { useState } from "react";
import { DriverApplication } from "../api/drivers.api";
import { Button } from "@/components/ui/button";
import {
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Check, X } from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { approveDriverApplication, rejectDriverApplication } from "../api";

interface DriverApplicationDetailProps {
    application: DriverApplication;
    onUpdate: () => void;
    onClose: () => void;
}

export function DriverApplicationDetail({
    application,
    onUpdate,
    onClose,
}: DriverApplicationDetailProps) {
    const [isUpdating, setIsUpdating] = useState(false);
    const { toast } = useToast();
    const t = useTranslations("admin.drivers.detail");

    const handleAction = async (status: "APPROVED" | "REJECTED") => {
        setIsUpdating(true);
        try {
            if (status === "APPROVED") {
                await approveDriverApplication(application.id);
            } else {
                await rejectDriverApplication(application.id);
            }

            toast({
                title:
                    status === "APPROVED"
                        ? t("approvedTitle")
                        : t("rejectedTitle"),
                description: t("statusUpdatedDesc"),
            });
            onUpdate();
        } catch (error) {
            toast({
                title: t("error"),
                description: error instanceof Error ? error.message : t("errorDesc"),
                variant: "destructive",
            });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <DialogHeader className="p-6 pb-2">
                <DialogTitle>{t("title")}</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">
                            {t("applicant")}
                        </h3>
                        <p className="font-medium">{application.user.name}</p>
                        <p className="text-sm text-muted-foreground">
                            {application.user.email}
                        </p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">
                            {t("submissionDate")}
                        </h3>
                        <p>
                            {format(new Date(application.createdAt), "dd MMMM yyyy HH:mm", {
                                locale: enUS,
                            })}
                        </p>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">
                            {t("currentStatus")}
                        </h3>
                        <Badge
                            variant={
                                application.status === "APPROVED"
                                    ? "default"
                                    : application.status === "REJECTED"
                                        ? "destructive"
                                        : "secondary"
                            }
                            className={
                                application.status === "APPROVED"
                                    ? "bg-green-500 hover:bg-green-600"
                                    : ""
                            }
                        >
                            {application.status === "APPROVED"
                                ? t("approve")
                                : application.status === "REJECTED"
                                    ? t("reject")
                                    : t("pending")}
                        </Badge>
                    </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                    <h3 className="font-semibold">{t("vehicleInfo")}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground">
                                {t("vehicleType")}
                            </h4>
                            <p>{application.vehicleType}</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground">
                                {t("licensePlate")}
                            </h4>
                            <p className="font-mono bg-muted px-2 py-1 rounded inline-block">
                                {application.vehiclePlate}
                            </p>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground">
                                {t("licenseNumber")}
                            </h4>
                            <p>{application.licenseNumber}</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-muted-foreground">{t("siret")}</h4>
                            <p className="font-mono">{application.siret}</p>
                        </div>
                        {application.companyName && (
                            <div className="col-span-2">
                                <h4 className="text-sm font-medium text-muted-foreground">
                                    {t("companyName")}
                                </h4>
                                <p>{application.companyName}</p>
                            </div>
                        )}
                    </div>
                </div>

                {application.proposalRate && (
                    <div className="border-t pt-4">
                        <h3 className="font-semibold mb-2">{t("proposal")}</h3>
                        <div className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap">
                            {application.proposalRate}
                        </div>
                    </div>
                )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 p-6 pt-4 border-t mt-auto">
                <Button variant="outline" onClick={onClose}>
                    {t("close")}
                </Button>
                {application.status === "PENDING" && (
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                            variant="destructive"
                            onClick={() => handleAction("REJECTED")}
                            disabled={isUpdating}
                            className="flex-1 sm:flex-none"
                        >
                            {isUpdating ? (
                                <LottieLoader width={20} height={20} />
                            ) : (
                                <X className="w-4 h-4 mr-2" />
                            )}
                            {t("reject")}
                        </Button>
                        <Button
                            onClick={() => handleAction("APPROVED")}
                            disabled={isUpdating}
                            className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700"
                        >
                            {isUpdating ? (
                                <LottieLoader width={20} height={20} />
                            ) : (
                                <Check className="w-4 h-4 mr-2" />
                            )}
                            {t("approve")}
                        </Button>
                    </div>
                )}
            </DialogFooter>
        </div>
    );
}
