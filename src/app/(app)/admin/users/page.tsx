"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { UsersTable, RoleManagementDialog } from "@/features/app/admin/ui";
import { useAdmin } from "@/features/app/admin/hooks/useAdmin";
import { Users } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";
import { PublicProfile } from "@/features/app/profile/ui/PublicProfile";
import { useTranslations } from "next-intl";

export default function UsersPage() {
  // useSearchParams suspends during prerender, and this page is a client
  // component with no other boundary of its own.
  return (
    <Suspense fallback={<PageLoader />}>
      <UsersPageContent />
    </Suspense>
  );
}

function UsersPageContent() {
  const {
    users,
    roleDialogOpen,
    setRoleDialogOpen,
    selectedUser,
    setSelectedUser,
    handleUpdateRole,
    isUpdatingRole,
    isLoading,
    refetchUsers,
  } = useAdmin();
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const t = useTranslations("admin.users");
  // Seeds the table's search box. `/admin/expedion-clients` links here with the
  // client's address when their quotes are owned by an account, and without
  // this the link landed on an unfiltered list and left the admin to find them.
  const initialSearch = useSearchParams().get("search") ?? "";

  // "View profile" used to be a menu item wired to nothing: this page never
  // passed the callback, so the only place it worked was /admin/drivers.
  if (profileUserId) {
    return (
      <PublicProfile
        id={profileUserId}
        onBack={() => setProfileUserId(null)}
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
            <Users className="w-8 h-8 text-primary" />
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <UsersTable
        users={users}
        onManageRole={(user) => {
          setSelectedUser(user);
          setRoleDialogOpen(true);
        }}
        onViewProfile={(user) => setProfileUserId(user.id)}
        onUserUpdated={() => refetchUsers()}
        initialSearch={initialSearch}
      />

      <RoleManagementDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        user={selectedUser}
        onUpdateRole={handleUpdateRole}
        isUpdating={isUpdatingRole}
      />
    </div>
  );
}
