"use client";

import { ProtectedRoute } from "@/lib/protected-route";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useHome } from "@/features/app/home/hooks";
import {
  ListingCard,
  FilterSheet,
  MapView,
  SearchBar,
} from "@/features/app/home/ui";
import { toast } from "sonner";
import { RefreshCw, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/page-loader";
import { CenteredEmptyState } from "@/components/ui/centered-empty-state";
import { useTranslations } from "next-intl";

/**
 * Home Page
 * Following rules.md:
 * - Page contains NO business logic
 * - All logic is in useHome hook
 * - All UI components are in feature/ui folder
 * - Clean separation of concerns
 */
export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    searchQuery,
    setSearchQuery,
    showMap,
    setShowMap,
    filters,
    setFilters,
    listings,
    isLoading,
    isError,
    applySearch,
    applyFilters,
    clearFilters,
    refetch,
    isRefetching,
  } = useHome();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const t = useTranslations("home");

  // Check for email verification success
  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      toast.success("Email verified successfully!", {
        description: "Welcome to EXPEDITOO! Your account is now active.",
        duration: 5000,
      });

      // Remove the query param from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("verified");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  const handleListingClick = (id: string) => {
    router.push(`/listing/${id}`);
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <PageLoader />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="flex flex-col h-[calc(100vh-4rem)] pb-16 xl:pb-0 w-full">
        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={applySearch}
          showMap={showMap}
          onMapToggle={() => setShowMap(!showMap)}
          onFilterOpen={() => setIsFilterOpen(true)}
        />

        <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
          <>
            {/* Listings Panel */}
            <div
              className={`w-full xl:w-1/2 flex flex-col overflow-hidden h-full ${showMap ? "hidden xl:flex" : "flex"}`}
            >
              <div className="py-4 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-lg">{t("title")}</h2>
                    <p className="text-sm text-muted-foreground truncate w-max-md">
                      {t("subtitle")}
                    </p>
                  </div>
                  {/* Pull-to-Refresh Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isRefetching}
                    className="gap-2"
                  >
                    <RefreshCw className={`w-4 h-4`} />
                    <span className="hidden sm:inline">
                      {isRefetching
                        ? t("actions.refreshing")
                        : t("actions.refresh")}
                    </span>
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-4 flex flex-col">
                {/* Error State */}
                {isError && (
                  <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                    <p className="text-muted-foreground">{t("states.error")}</p>
                    <button
                      onClick={() => refetch()}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                    >
                      {t("states.retry")}
                    </button>
                  </div>
                )}

                {/* Empty State */}
                {!isLoading && !isError && listings.length === 0 && (
                  <CenteredEmptyState
                    variant="page"
                    icon={PackageOpen}
                    title={t("states.empty")}
                    description={t("states.emptyDesc")}
                  >
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 bg-muted text-foreground text-sm font-medium rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      {t("states.clearFilters")}
                    </button>
                  </CenteredEmptyState>
                )}

                {/* Listings */}
                {!isLoading &&
                  !isError &&
                  listings.map((listing, index) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      onClick={() => handleListingClick(listing.id)}
                      index={index}
                    />
                  ))}
              </div>
            </div>

            {/* Map Panel */}
            <div
              className={`w-full xl:w-1/2 border-l relative bg-muted/10 h-[calc(100vh-5rem)] md:h-full ${showMap ? "block" : "hidden xl:block"}`}
            >
              <MapView
                listings={listings}
                onListingClick={handleListingClick}
              />
            </div>
          </>
        </div>
      </div>

      <FilterSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        onApplyFilters={applyFilters}
        onClearFilters={clearFilters}
      />
    </ProtectedRoute>
  );
}
