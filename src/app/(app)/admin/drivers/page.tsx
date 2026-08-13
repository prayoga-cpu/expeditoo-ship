"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FileText, Truck } from "lucide-react";

import { UsersTable } from "@/features/app/admin/ui/UsersTable";
import { DriverApplicationsList } from "@/features/app/admin/ui/DriverApplicationsList";
import { useAdminDrivers } from "@/features/app/admin/hooks/useAdminDrivers";
import { PageLoader } from "@/components/ui/page-loader";
import { useTranslations } from "next-intl";
import { PublicProfile } from "@/features/app/profile/ui/PublicProfile";

export default function DriversPage() {
  const { drivers, isLoading, handleRemoveDriver, refetchDrivers } =
    useAdminDrivers();

  const [activeTab, setActiveTab] = useState("list");
  const [isMounted, setIsMounted] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const t = useTranslations("admin.drivers");

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
      />
    );
  }

  if (isLoading) {
    return <PageLoader variant="admin" />;
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
      </div>

      <Tabs
        defaultValue="list"
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <Users className="w-4 h-4" />
            Drivers List
          </TabsTrigger>
          <TabsTrigger value="applications" className="gap-2">
            <FileText className="w-4 h-4" />
            Applications
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
          <DriverApplicationsList tableMinHeight="40vh" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
