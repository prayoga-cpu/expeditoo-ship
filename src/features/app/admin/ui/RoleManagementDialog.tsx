"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { X } from "lucide-react";
import type { User } from "../types";
import { useTranslations } from "next-intl";
import { useToast } from "@/hooks/use-toast";
import { MANAGEABLE_ROLES, chipsHeld } from "../lib/role-groups";

interface RoleManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onUpdateRole: (role: string) => void;
  /** Omitted keeps the held chips read-only rather than showing a control
   * that would just 403 — same convention as `UsersTable`'s own chips. */
  onRemoveRole?: (
    user: User,
    role: string
  ) => Promise<{ success: boolean; message: string }>;
  isUpdating: boolean;
}

export function RoleManagementDialog({
  open,
  onOpenChange,
  user,
  onUpdateRole,
  onRemoveRole,
  isUpdating,
}: RoleManagementDialogProps) {
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [removing, setRemoving] = useState<string | null>(null);
  const t = useTranslations("admin.roles");
  const tTable = useTranslations("admin.users.table");
  const { toast } = useToast();

  const held = user ? chipsHeld(user.roles) : [];
  const addable = MANAGEABLE_ROLES.filter((role) => !held.includes(role));

  const handleOpenChange = (newOpen: boolean) => {
    if (!isUpdating) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setSelectedRole("");
      }
    }
  };

  const handleAssignRole = () => {
    if (selectedRole) {
      onUpdateRole(selectedRole);
      setSelectedRole("");
    }
  };

  const handleRemove = async (role: string) => {
    if (!user || !onRemoveRole) return;
    setRemoving(role);
    try {
      const result = await onRemoveRole(user, role);
      if (!result.success) {
        toast({ description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")} <strong>{user?.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("currentRoles")}
            </p>
            <div className="flex flex-wrap gap-1">
              {held.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  {t("noRoles")}
                </span>
              )}
              {held.map((role) => {
                const label = t(role);
                return (
                  <Badge
                    key={role}
                    variant="secondary"
                    className="gap-1 text-xs capitalize"
                  >
                    {label}
                    {onRemoveRole && held.length > 1 && (
                      <button
                        type="button"
                        disabled={removing === role || isUpdating}
                        onClick={() => handleRemove(role)}
                        className="rounded-full hover:bg-muted-foreground/20 disabled:opacity-50"
                        aria-label={tTable("removeRole", { role: label })}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                );
              })}
            </div>
          </div>

          {addable.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {t("addRole")}
              </p>
              <div className="flex gap-2">
                <Select
                  value={selectedRole}
                  onValueChange={setSelectedRole}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={t("selectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {addable.map((role) => (
                      <SelectItem key={role} value={role}>
                        {t(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAssignRole}
                  disabled={isUpdating || !selectedRole}
                >
                  {isUpdating ? (
                    <LottieLoader width={20} height={20} />
                  ) : (
                    t("assignRole")
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isUpdating}
          >
            {t("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
