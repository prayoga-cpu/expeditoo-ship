"use client";

import { useTranslations } from "next-intl";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { PeriodKey } from "@/lib/statement-period";

/**
 * The Cocolis period dropdown, once for both tabs of the transaction history
 * so the requester's documents and the carrier's statement offer the same
 * choices (`PERIOD_KEYS` in `src/lib/statement-period.ts`).
 */
export function PeriodSelect({
    value,
    onChange,
}: {
    value: PeriodKey;
    onChange: (period: PeriodKey) => void;
}) {
    const t = useTranslations("profile.invoices.periods");

    return (
        <Select value={value} onValueChange={(next) => onChange(next as PeriodKey)}>
            <SelectTrigger className="sm:w-[200px]" aria-label={t("label")}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">{t("all")}</SelectItem>
                <SelectItem value="this_month">{t("thisMonth")}</SelectItem>
                <SelectItem value="last_month">{t("lastMonth")}</SelectItem>
                <SelectItem value="this_year">{t("thisYear")}</SelectItem>
            </SelectContent>
        </Select>
    );
}
