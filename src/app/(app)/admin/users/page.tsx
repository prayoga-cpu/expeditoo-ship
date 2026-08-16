"use client";

import { UsersTable, RoleManagementDialog } from "@/features/app/admin/ui";
import { useAdmin } from "@/features/app/admin/hooks/useAdmin";
import { Users } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";
import { useTranslations } from "next-intl";

export default function UsersPage() {
  const {
    users,
    roleDialogOpen,
    setRoleDialogOpen,
    selectedUser,
    setSelectedUser,
    handleUpdateRole,
    isUpdatingRole,
    isLoading,
  } = useAdmin();
  const t = useTranslations("admin.users");

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
