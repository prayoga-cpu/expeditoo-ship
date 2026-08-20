"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MoreVertical,
  Ban,
  CheckCircle,
  Trash2,
  Eye,
  Shield,
  UserMinus,
  LogIn,
  KeyRound,
  LogOut,
  Copy,
} from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  useDeleteUser,
  useImpersonateUser,
  useRevokeUserSessions,
  useSendPasswordReset,
  useUpdateUserStatus,
} from "../hooks/useUserModeration";
import { useToast } from "@/hooks/use-toast";
import type { User } from "../types";
import { useLocale, useTranslations } from "next-intl";
import { format, formatDistanceToNow } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { DataTable, DataTableColumnHeader, dateRangeFilterFn } from "./data-table";
import { DeleteUserDialog } from "./DeleteUserDialog";

type ConfirmAction =
  | "suspend"
  | "activate"
  | "remove_driver"
  | "revoke_sessions"
  | "password_reset"
  | "impersonate";

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

function StatusBadge({ status }: { status: User["status"] }) {
  const t = useTranslations("admin.users.status");

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
        status === "active"
          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
          : status === "suspended"
            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
            : "bg-muted text-muted-foreground"
      }`}
    >
      {t(status)}
    </span>
  );
}

/**
 * Which product the account signs in to.
 *
 * Both apps share this user table, so without saying it the list mixes drivers
 * and Expedion clients with nothing to tell them apart.
 */
function OriginBadge({ origin }: { origin: User["origin"] }) {
  const t = useTranslations("admin.users.origin");

  return (
    <Badge
      variant="outline"
      className={
        origin === "expedion"
          ? "border-violet-500/40 text-violet-600 dark:text-violet-400"
          : "border-primary/40 text-primary"
      }
    >
      {t(origin)}
    </Badge>
  );
}

/** Relative for scanning a column, absolute in the tooltip for precision. */
function LastLoginCell({ value }: { value: string | null }) {
  const locale = useLocale();
  const t = useTranslations("admin.users.table");
  const dateLocale = locale === "fr" ? fr : enUS;

  if (!value) {
    return <span className="text-muted-foreground/60">{t("never")}</span>;
  }

  const date = new Date(value);

  return (
    <span
      className="text-muted-foreground"
      title={format(date, "dd MMM yyyy HH:mm", { locale: dateLocale })}
    >
      {formatDistanceToNow(date, { addSuffix: true, locale: dateLocale })}
    </span>
  );
}

/**
 * A menu item the server may refuse for this row.
 *
 * `blocked` is a refusal code from account-policy.ts. When set, the item is
 * still drawn — disabled, with the reason under it — so the admin can see that
 * the action exists and why it is unavailable here.
 */
function BlockableItem({
  blocked,
  onSelect,
  className,
  children,
}: {
  blocked: string | null;
  onSelect: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("admin.users.blocked");

  if (!blocked) {
    return (
      <DropdownMenuItem className={className} onClick={onSelect}>
        {children}
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem disabled className="flex-col items-start gap-0.5">
      <span className="flex items-center">{children}</span>
      <span className="pl-6 text-xs text-muted-foreground whitespace-normal">
        {/* A code the client has no copy for is shown raw rather than crashing
            the row: the server can add refusals faster than the messages. */}
        {t.has(blocked) ? t(blocked) : blocked}
      </span>
    </DropdownMenuItem>
  );
}

function UserActions({
  user,
  viewMode,
  onManageRole,
  onViewProfile,
  onCopyId,
  onRemoveDriverClick,
  onDeleteClick,
  onConfirmAction,
}: {
  user: User;
  viewMode: "users" | "drivers";
  onManageRole?: (user: User) => void;
  onViewProfile?: (user: User) => void;
  onCopyId: (user: User) => void;
  onRemoveDriverClick: (user: User) => void;
  onDeleteClick: (user: User) => void;
  onConfirmAction: (user: User, action: ConfirmAction) => void;
}) {
  const isSuspended = user.status === "suspended";
  const t = useTranslations("admin.users.actions");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => onViewProfile?.(user)}>
          <Eye className="w-4 h-4 mr-2" />
          {t("viewProfile")}
        </DropdownMenuItem>

        {viewMode === "users" && onManageRole && (
          <DropdownMenuItem onClick={() => onManageRole(user)}>
            <Shield className="w-4 h-4 mr-2" />
            {t("manageRoles")}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={() => onCopyId(user)}>
          <Copy className="w-4 h-4 mr-2" />
          {t("copyId")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Blocked actions stay on the menu, disabled, with the server's
            reason. Hiding them made the item vanish with no explanation, which
            reads as a bug; offering them and letting the endpoint 403 is no
            better. */}
        <BlockableItem
          blocked={user.impersonateBlocked}
          onSelect={() => onConfirmAction(user, "impersonate")}
        >
          <LogIn className="w-4 h-4 mr-2" />
          {t("impersonate")}
        </BlockableItem>

        <DropdownMenuItem
          onClick={() => onConfirmAction(user, "password_reset")}
        >
          <KeyRound className="w-4 h-4 mr-2" />
          {t("passwordReset")}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onConfirmAction(user, "revoke_sessions")}
        >
          <LogOut className="w-4 h-4 mr-2" />
          {t("revokeSessions")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {viewMode === "drivers" && (
          <DropdownMenuItem
            className="text-red-600"
            onClick={() => onRemoveDriverClick(user)}
          >
            <UserMinus className="w-4 h-4 mr-2" />
            {t("removeDriver")}
          </DropdownMenuItem>
        )}

        <BlockableItem
          blocked={user.suspendBlocked}
          className={isSuspended ? "text-green-600" : "text-orange-600"}
          onSelect={() =>
            onConfirmAction(user, isSuspended ? "activate" : "suspend")
          }
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
        </BlockableItem>

        {viewMode === "users" && (
          <BlockableItem
            blocked={user.deleteBlocked}
            className="text-red-600"
            onSelect={() => onDeleteClick(user)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t("delete")}
          </BlockableItem>
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
    action: ConfirmAction;
  }>({ open: false, user: null, action: "suspend" });
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const { toast } = useToast();
  const updateStatus = useUpdateUserStatus();
  const revokeSessions = useRevokeUserSessions();
  const sendPasswordReset = useSendPasswordReset();
  const impersonate = useImpersonateUser();
  const deleteUser = useDeleteUser();

  const tTable = useTranslations("admin.users.table");
  const tDialogs = useTranslations("admin.users.dialogs");
  const tMessages = useTranslations("admin.users.messages");

  const isPending =
    updateStatus.isPending ||
    revokeSessions.isPending ||
    sendPasswordReset.isPending ||
    impersonate.isPending;

  const closeConfirm = () =>
    setConfirmDialog({ open: false, user: null, action: "suspend" });

  const notifyError = (error: Error) =>
    toast({
      title: tMessages("error"),
      description: error.message || tMessages("errorDesc"),
      variant: "destructive",
    });

  const handleCopyId = async (user: User) => {
    await navigator.clipboard.writeText(user.id);
    toast({ title: tMessages("idCopied"), description: user.id });
  };

  /** Toast, tell the page, close the dialog. */
  const settle = (user: User, title: string, description: string) => {
    toast({ title, description });
    onUserUpdated?.(user);
    closeConfirm();
  };

  const runStatusChange = (user: User, banned: boolean) =>
    updateStatus.mutate(
      { userId: user.id, banned },
      {
        onSuccess: () =>
          settle(
            user,
            banned ? tMessages("suspended") : tMessages("activated"),
            banned
              ? tMessages("suspendedDesc", { name: user.name })
              : tMessages("activatedDesc", { name: user.name })
          ),
        onError: notifyError,
      }
    );

  const runRevokeSessions = (user: User) =>
    revokeSessions.mutate(user.id, {
      onSuccess: (result) =>
        settle(
          user,
          tMessages("sessionsRevoked"),
          tMessages("sessionsRevokedDesc", {
            name: user.name,
            count: result.revoked,
          })
        ),
      onError: notifyError,
    });

  const runPasswordReset = (user: User) =>
    sendPasswordReset.mutate(user.id, {
      onSuccess: () =>
        settle(
          user,
          tMessages("resetSent"),
          tMessages("resetSentDesc", { email: user.email })
        ),
      onError: notifyError,
    });

  const runImpersonate = (user: User) =>
    impersonate.mutate(user.id, {
      // A full reload, not a router push: the session cookie now belongs to
      // somebody else, so every cached query and every server component on
      // screen was rendered for the wrong identity.
      onSuccess: () => window.location.assign("/home"),
      onError: notifyError,
    });

  const handleConfirmAction = () => {
    const user = confirmDialog.user;
    if (!user) return;

    switch (confirmDialog.action) {
      case "remove_driver":
        onRemoveDriver?.(user);
        closeConfirm();
        return;
      case "suspend":
        return runStatusChange(user, true);
      case "activate":
        return runStatusChange(user, false);
      case "revoke_sessions":
        return runRevokeSessions(user);
      case "password_reset":
        return runPasswordReset(user);
      case "impersonate":
        return runImpersonate(user);
    }
  };

  const handleDelete = () => {
    const user = deleteTarget;
    if (!user) return;

    deleteUser.mutate(user.id, {
      onSuccess: () => {
        toast({
          title: tMessages("deleted"),
          description: tMessages("deletedDesc", { name: user.name }),
        });
        onUserUpdated?.(user);
        setDeleteTarget(null);
      },
      onError: notifyError,
    });
  };

  const columns: ColumnDef<User>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tTable("name")} />
        ),
        cell: ({ row }) => (
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">{row.original.name}</p>
              <OriginBadge origin={row.original.origin} />
            </div>
            <p className="text-sm text-muted-foreground">
              {row.original.email}
            </p>
          </div>
        ),
        filterFn: (row, id, filterValue) => {
          const value = (filterValue as string).toLowerCase();
          return (
            row.original.name.toLowerCase().includes(value) ||
            row.original.email.toLowerCase().includes(value)
          );
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
        accessorKey: "lastLoginAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tTable("lastLogin")} />
        ),
        cell: ({ row }) => <LastLoginCell value={row.original.lastLoginAt} />,
      },
      {
        accessorKey: "joinDate",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tTable("joinDate")} />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.joinDate}</span>
        ),
        filterFn: dateRangeFilterFn<User>(),
      },
      {
        accessorKey: "role",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={tTable("role")} />
        ),
        cell: ({ row }) => (
          <Badge variant="secondary" className="text-xs capitalize">
            {row.original.role}
          </Badge>
        ),
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
              onCopyId={handleCopyId}
              onRemoveDriverClick={(user) =>
                setConfirmDialog({ open: true, user, action: "remove_driver" })
              }
              onDeleteClick={setDeleteTarget}
              onConfirmAction={(user, action) =>
                setConfirmDialog({ open: true, user, action })
              }
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

  const action = confirmDialog.action;
  const name = confirmDialog.user?.name ?? "";
  const destructive =
    action === "suspend" ||
    action === "remove_driver" ||
    action === "revoke_sessions";

  return (
    <>
      <DataTable
        columns={columns}
        data={users}
        searchKey="name"
        searchPlaceholder={tTable("searchPlaceholder")}
        className={className}
        tableMinHeight={tableMinHeight}
        dateFilterKey="joinDate"
      />

      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tDialogs(`${action}.title`)}</AlertDialogTitle>
            <AlertDialogDescription>
              {tDialogs(`${action}.description`, { name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {tDialogs("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleConfirmAction();
              }}
              disabled={isPending}
              className={
                destructive
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }
            >
              {isPending ? (
                <>
                  <LottieLoader width={20} height={20} className="mr-2" />
                  {tDialogs("processing")}
                </>
              ) : (
                tDialogs(`${action}.confirm`)
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeleteUserDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        user={deleteTarget}
        onConfirm={handleDelete}
        isDeleting={deleteUser.isPending}
      />
    </>
  );
}
