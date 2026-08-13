"use client";

import { useState, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MoreVertical,
  Ban,
  CheckCircle,
  Trash2,
  Eye,
  Shield,
  UserMinus,
} from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUpdateUserStatus } from "../hooks/useUserModeration";
import { useToast } from "@/hooks/use-toast";
import type { User } from "../types";
import { useTranslations } from "next-intl";
import { DataTable, DataTableColumnHeader } from "./data-table";

interface UsersTableProps {
  users: User[];
  onManageRole?: (user: User) => void;
  onRemoveDriver?: (user: User) => void;
  onUserUpdated?: (user: User) => void;
  onViewProfile?: (user: User) => void;
  viewMode?: "users" | "drivers";
  className?: string;
  tableMinHeight?: string;
}

// Status badge component for reuse
function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
        status === "active"
          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
          : status === "suspended"
            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
            : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
      }`}
    >
      {status}
    </span>
  );
}

// Action menu component for reuse
function UserActions({
  user,
  viewMode,
  onManageRole,
  onViewProfile,
  onRemoveDriverClick,
  onSuspendClick,
}: {
  user: User;
  viewMode: "users" | "drivers";
  onManageRole?: (user: User) => void;
  onViewProfile?: (user: User) => void;
  onRemoveDriverClick: (user: User) => void;
  onSuspendClick: (user: User) => void;
}) {
  const isSuspended = user.status === "suspended" || user.status === "inactive";
  const t = useTranslations("admin.users.actions");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {viewMode === "users" && onManageRole && (
          <DropdownMenuItem onClick={() => onManageRole(user)}>
            <Shield className="w-4 h-4 mr-2" />
            {t("manageRoles")}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={() => onViewProfile?.(user)}>
          <Eye className="w-4 h-4 mr-2" />
          {t("viewProfile")}
        </DropdownMenuItem>

        {viewMode === "drivers" && (
          <DropdownMenuItem
            className="text-red-600"
            onClick={() => onRemoveDriverClick(user)}
          >
            <UserMinus className="w-4 h-4 mr-2" />
            {t("removeDriver")}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          className={isSuspended ? "text-green-600" : "text-orange-600"}
          onClick={() => onSuspendClick(user)}
        >
          {isSuspended ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              {t("activate")}
            </>
          ) : (
            <>
              <Ban className="w-4 h-4 mr-2" />
              {t("suspend")}
            </>
          )}
        </DropdownMenuItem>

        {viewMode === "users" && (
          <DropdownMenuItem className="text-red-600">
            <Trash2 className="w-4 h-4 mr-2" />
            {t("delete")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function UsersTable({
  users,
  onManageRole,
  onRemoveDriver,
  onUserUpdated,
  onViewProfile,
  viewMode = "users",
  className,
  tableMinHeight,
}: UsersTableProps) {
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    user: User | null;
    action: "suspend" | "activate" | "remove_driver";
  }>({ open: false, user: null, action: "suspend" });

  const { toast } = useToast();
  const updateStatusMutation = useUpdateUserStatus();
  const tTable = useTranslations("admin.users.table");
  const tDialogs = useTranslations("admin.users.dialogs");
  const tMessages = useTranslations("admin.users.messages");

  const handleSuspendClick = (user: User) => {
    const isSuspended =
      user.status === "suspended" || user.status === "inactive";
    setConfirmDialog({
      open: true,
      user,
      action: isSuspended ? "activate" : "suspend",
    });
  };

  const handleRemoveDriverClick = (user: User) => {
    setConfirmDialog({
      open: true,
      user,
      action: "remove_driver",
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog.user) return;

    if (confirmDialog.action === "remove_driver") {
      if (onRemoveDriver) {
        onRemoveDriver(confirmDialog.user);
        setConfirmDialog({ open: false, user: null, action: "suspend" });
      }
      return;
    }

    const banned = confirmDialog.action === "suspend";

    updateStatusMutation.mutate(
      { userId: confirmDialog.user.id, banned },
      {
        onSuccess: () => {
          toast({
            title: banned ? tMessages("suspended") : tMessages("activated"),
            description: banned
              ? tMessages("suspendedDesc", {
                  name: confirmDialog.user?.name || "",
                })
              : tMessages("activatedDesc", {
                  name: confirmDialog.user?.name || "",
                }),
          });
          if (onUserUpdated && confirmDialog.user) {
            onUserUpdated(confirmDialog.user);
          }
          setConfirmDialog({ open: false, user: null, action: "suspend" });
        },
        onError: (error) => {
          toast({
            title: tMessages("error"),
            description: error.message || tMessages("errorDesc"),
            variant: "destructive",
          });
        },
      }
    );
  };

  // Define columns for TanStack Table
  const columns: ColumnDef<User>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tTable("name")} />
        ),
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.name}</p>
            <p className="text-sm text-muted-foreground">
              {row.original.email}
            </p>
          </div>
        ),
        filterFn: (row, id, filterValue) => {
          const name = row.original.name.toLowerCase();
          const email = row.original.email.toLowerCase();
          const value = (filterValue as string).toLowerCase();
          return name.includes(value) || email.includes(value);
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tTable("status")} />
        ),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "joinDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tTable("joinDate")} />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.joinDate}</span>
        ),
      },
      {
        accessorKey: "role",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tTable("role")} />
        ),
        cell: ({ row }) => {
          const role = row.original.role;
          let displayRole = role;
          if (
            ["buyer", "seller", "auctioneer", "operator", "user"].includes(
              role.toLowerCase()
            )
          ) {
            displayRole = "User";
          } else if (role.toLowerCase() === "transporter") {
            displayRole = "Driver";
          } else if (role.toLowerCase() === "admin") {
            displayRole = "Admin";
          }

          return (
            <Badge variant="secondary" className="text-xs">
              {displayRole}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{tTable("actions")}</span>,
        cell: ({ row }) => (
          <div className="text-right">
            <UserActions
              user={row.original}
              viewMode={viewMode}
              onManageRole={onManageRole}
              onViewProfile={onViewProfile}
              onRemoveDriverClick={handleRemoveDriverClick}
              onSuspendClick={handleSuspendClick}
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewMode]
  );

  return (
    <>
      {/* Table View - works on all screens with horizontal scroll on mobile */}
      <DataTable
        columns={columns}
        data={users}
        searchKey="name"
        searchPlaceholder={tTable("searchPlaceholder")}
        className={className}
        tableMinHeight={tableMinHeight}
      />


      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "suspend"
                ? tDialogs("suspendTitle")
                : confirmDialog.action === "activate"
                  ? tDialogs("activateTitle")
                  : tDialogs("removeDriverTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "suspend"
                ? tDialogs("suspendDesc", {
                    name: confirmDialog.user?.name || "",
                  })
                : confirmDialog.action === "activate"
                  ? tDialogs("activateDesc", {
                      name: confirmDialog.user?.name || "",
                    })
                  : tDialogs("removeDriverDesc", {
                      name: confirmDialog.user?.name || "",
                    })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateStatusMutation.isPending}>
              {tDialogs("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={updateStatusMutation.isPending}
              className={
                confirmDialog.action === "suspend" ||
                confirmDialog.action === "remove_driver"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }
            >
              {updateStatusMutation.isPending ? (
                <>
                  <LottieLoader width={20} height={20} className="mr-2" />
                  {tDialogs("processing")}
                </>
              ) : confirmDialog.action === "suspend" ? (
                tDialogs("suspend")
              ) : confirmDialog.action === "remove_driver" ? (
                tDialogs("remove")
              ) : (
                tDialogs("activate")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
