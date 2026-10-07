"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChevronRight, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineLoader } from "@/components/ui/page-loader";
import { addressDisplayName } from "@/lib/saved-address";
import { fetchAddresses, type Address } from "../api";

/** Rows shown before « Tout afficher ». */
const FIRST_ROWS = 3;
const RETURN_HERE = "returnUrl=/profile";

/**
 * Every saved address on `/profile`, not only the default
 * (saved_addresses_spec.md §4.1). Same `["user-addresses"]` cache as
 * `/profile/addresses` and `/create`, so a change in one shows in the others.
 */
export function SavedAddressesCard() {
  const t = useTranslations("profile.address");
  const [showAll, setShowAll] = useState(false);
  const { data: addresses = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["user-addresses"],
    queryFn: fetchAddresses,
  });
  const shown = showAll ? addresses : addresses.slice(0, FIRST_ROWS);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="w-5 h-5 text-primary" />
          {t("title")}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/profile/addresses/create?${RETURN_HERE}`} aria-label={t("addNew")}>
            <Plus className="w-4 h-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <InlineLoader size="md" className="h-16" />
        ) : isError ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-destructive">{t("loadError")}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t("retry")}
            </Button>
          </div>
        ) : (
          <>
            {addresses.length === 0 && (
              <p className="text-muted-foreground text-sm">{t("noAddress")}</p>
            )}
            <ul className="space-y-2">
              {shown.map((address) => (
                <li key={address.id}>
                  <AddressRow address={address} />
                </li>
              ))}
            </ul>
            {addresses.length > FIRST_ROWS && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                aria-expanded={showAll}
                onClick={() => setShowAll((open) => !open)}
              >
                {showAll ? t("showLess") : t("showAll", { count: addresses.length })}
              </Button>
            )}
            <Link
              href={`/profile/addresses/create?${RETURN_HERE}`}
              className="flex items-center gap-3 rounded-lg border border-dashed p-3 text-sm font-medium transition-colors hover:bg-muted/50"
            >
              <Plus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {t("addNew")}
            </Link>
            {addresses.length > 0 && (
              <Link
                href="/profile/addresses"
                className="block pt-1 text-sm text-primary hover:underline"
              >
                {t("manage")}
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AddressRow({ address }: { address: Address }) {
  const t = useTranslations("profile.address");
  const name = addressDisplayName(address, (p) => t(`form.labelPresets.${p}`));

  return (
    <Link
      href={`/profile/addresses/${address.id}/edit?${RETURN_HERE}`}
      className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
    >
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{name}</span>
          <AddressBadges address={address} />
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {address.street}, {address.zip} {address.city}
        </p>
      </div>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

/** « Par défaut » and the end the address is kept for, wherever it is listed. */
export function AddressBadges({ address }: { address: Address }) {
  const t = useTranslations("profile.address");
  return (
    <>
      {address.isDefault && (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
          {t("default")}
        </span>
      )}
      {address.usedFor && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {t(`usedFor.${address.usedFor}`)}
        </span>
      )}
    </>
  );
}
