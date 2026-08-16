"use client";

import { ListingsTable } from "@/features/app/admin/ui/ListingsTable";
import { AlertCircle, Package } from "lucide-react";
import { useState, useCallback } from "react";
import { useAdminListings } from "@/features/app/admin/hooks/useAdminListings";
import { PageLoader } from "@/components/ui/page-loader";
import { useTranslations } from "next-intl";
import { JobDetail } from "@/features/app/listing/ui";

export default function ListingsPage() {
  const {
    data: listings,
    isLoading,
    error,
    deleteListing,
  } = useAdminListings();
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    null
  );
  const t = useTranslations("admin.listings");

  const handleView = useCallback((id: string) => {
    setSelectedListingId(id);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      deleteListing(id);
    },
    [deleteListing]
  );

  if (selectedListingId) {
    return (
      <JobDetail listingId={selectedListingId} viewerId={null} />
    );
  }

  if (isLoading) {
    return <PageLoader />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-destructive">
        <AlertCircle className="h-6 w-6 mr-2" />
        <span>Failed to load listings</span>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Package className="w-8 h-8 text-primary" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <ListingsTable
        listings={listings || []}
        onView={handleView}
        onDelete={handleDelete}
      />
    </div>
  );
}
