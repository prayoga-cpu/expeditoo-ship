"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Bot, TrendingUp, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

interface AutoBidDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentBid: number;
    minimumIncrease: number;
    onConfirm: (maxBid: number, increment: number) => void;
}

export function AutoBidDialog({
    open,
    onOpenChange,
    currentBid,
    minimumIncrease,
    onConfirm,
}: AutoBidDialogProps) {
    const t = useTranslations("auction.autoBid");
    const [maxBid, setMaxBid] = useState<string>("");
    const [increment, setIncrement] = useState<string>(String(minimumIncrease));

    const suggestedMax = currentBid + minimumIncrease * 10;

    const handleConfirm = () => {
        const maxBidValue = Number(maxBid);
        const incrementValue = Number(increment);
        if (maxBidValue > currentBid && incrementValue >= minimumIncrease) {
            onConfirm(maxBidValue, incrementValue);
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-primary" />
                        {t("title")}
                    </DialogTitle>
                    <DialogDescription>{t("description")}</DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-4">
                    {/* Current Bid Info */}
                    <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">{t("currentBid")}</span>
                        <span className="font-semibold">€{currentBid}</span>
                    </div>

                    {/* Max Bid Input */}
                    <div className="space-y-2">
                        <Label htmlFor="maxBid">{t("maxBidLabel")}</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                €
                            </span>
                            <Input
                                id="maxBid"
                                type="number"
                                placeholder={String(suggestedMax)}
                                className="pl-8"
                                value={maxBid}
                                onChange={(e) => setMaxBid(e.target.value)}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t("maxBidHint", { suggested: suggestedMax })}
                        </p>
                    </div>

                    {/* Increment Selection */}
                    <div className="space-y-2">
                        <Label>{t("incrementLabel")}</Label>
                        <RadioGroup
                            value={increment}
                            onValueChange={setIncrement}
                            className="flex gap-2"
                        >
                            {[minimumIncrease, minimumIncrease * 2, minimumIncrease * 5].map(
                                (value) => (
                                    <div key={value} className="flex-1">
                                        <RadioGroupItem
                                            value={String(value)}
                                            id={`increment-${value}`}
                                            className="peer sr-only"
                                        />
                                        <Label
                                            htmlFor={`increment-${value}`}
                                            className="flex items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-center"
                                        >
                                            €{value}
                                        </Label>
                                    </div>
                                )
                            )}
                        </RadioGroup>
                    </div>

                    {/* How it works */}
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                            <div className="text-xs text-muted-foreground">
                                <p className="font-medium text-foreground mb-1">{t("howItWorks")}</p>
                                <p>{t("howItWorksDesc")}</p>
                            </div>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>{t("warning")}</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t("cancel")}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!maxBid || Number(maxBid) <= currentBid}
                    >
                        {t("confirm")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
