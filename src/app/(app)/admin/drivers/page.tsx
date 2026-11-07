"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText, Truck, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UsersTable } from "@/features/app/admin/ui/UsersTable";
import { CarrierApplicationsList } from "@/features/app/admin/ui/CarrierApplicationsList";
import { CreateDriverDialog } from "@/features/app/admin/ui/CreateDriverDialog";
import { useAdminDrivers } from "@/features/app/admin/hooks/useAdminDrivers";
import { PageLoader } from "@/components/ui/page-loader";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { PublicProfile } from "@/features/app/profile/ui/PublicProfile";

// `Suspense` is load-bearing: the tab is held in the URL, and a client page
// that reads `useSearchParams` without one fails `next build`.
export default function DriversPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <DriversPageContent />
    </Suspense>
  );
}

function DriversPageContent() {
  const { drivers, isLoading, handleRemoveDriver, refetchDrivers, createDriver, isCreating } =
    useAdminDrivers();

  // The tab lives in the URL: « Driver applications » used to be its own
  // sidebar entry, and the application emails and bell link straight to
  // `?tab=applications`.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = searchParams.get("tab") === "applications" ? "applications" : "list";
  const setActiveTab = (tab: string) =>
    router.replace(tab === "applications" ? `${pathname}?tab=applications` : pathname, {
      scroll: false,
    });
  const [isMounted, setIsMounted] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const t = useTranslations("admin.drivers");
  // Support and finance reach this page too; the API would refuse them.
  const roles = useAuth().user?.roles ?? [];
  const canCreate = roles.includes("admin") || roles.includes("operator");

  // Fix hydration error by mounting only on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  if (selectedDriverId) {
    return (
      <PublicProfile
        id={selectedDriverId}
        onBack={() => setSelectedDriverId(null)}
        staffView
      />
    );
  }

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Truck className="w-8 h-8 text-primary" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canCreate && (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            {t("createDialog.trigger")}
          </Button>
        )}
      </div>

      {canCreate && (
        <CreateDriverDialog
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          onCreate={createDriver}
          isCreating={isCreating}
        />
      )}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <Users className="w-4 h-4" />
            {t("tabs.list")}
          </TabsTrigger>
          <TabsTrigger value="applications" className="gap-2">
            <FileText className="w-4 h-4" />
            {t("tabs.applications")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4 data-[state=inactive]:hidden">
          <UsersTable
            users={drivers}
            viewMode="drivers"
            onRemoveDriver={handleRemoveDriver}
            onUserUpdated={() => refetchDrivers()}
            onViewProfile={(user) => setSelectedDriverId(user.id)}
            tableMinHeight="40vh"
          />
        </TabsContent>

        <TabsContent value="applications" className="space-y-4 data-[state=inactive]:hidden">
          <CarrierApplicationsList tableMinHeight="40vh" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
