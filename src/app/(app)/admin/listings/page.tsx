"use client";

import Link from "next/link";
import { ListingsTable } from "@/features/app/admin/ui/ListingsTable";
import { AlertCircle, ArrowLeft, Package } from "lucide-react";
import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAdminListings } from "@/features/app/admin/hooks/useAdminListings";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";
import { useTranslations } from "next-intl";
import { JobDetail } from "@/features/app/listing/ui";

export default function ListingsPage() {
  // useSearchParams suspends during prerender, and this page is a client
  // component with no other boundary of its own.
  return (
    <Suspense fallback={<PageLoader />}>
      <ListingsPageContent />
    </Suspense>
  );
}

function ListingsPageContent() {
  const {
    data: listings,
    isLoading,
    error,
    deleteListing,
  } = useAdminListings();
  const router = useRouter();
  // The opened listing lives in `?id=` rather than in state, so Supervision's
  // "Demandes directes" panel can link straight to one and the browser's Back
  // returns to the table (request_summary_spec.md §3.3).
  const selectedListingId = useSearchParams().get("id");
  const t = useTranslations("admin.listings");

  const handleView = useCallback(
    (id: string) => {
      router.push(`/admin/listings?id=${encodeURIComponent(id)}`);
    },
    [router]
  );

  const handleDelete = useCallback(
    (id: string) => {
      deleteListing(id);
    },
    [deleteListing]
  );

  if (selectedListingId) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link href="/admin/listings">
            <ArrowLeft className="h-4 w-4" />
            {t("backToList")}
          </Link>
        </Button>
        <JobDetail listingId={selectedListingId} viewerId={null} />
      </div>
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
