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
import { Button } from "@/components/ui/button";
import { LottieLoader } from "@/components/ui/lottie-loader";
import type { User } from "../types";
import { useTranslations } from "next-intl";

interface RoleManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onUpdateRole: (role: string) => void;
  isUpdating: boolean;
}

export function RoleManagementDialog({
  open,
  onOpenChange,
  user,
  onUpdateRole,
  isUpdating,
}: RoleManagementDialogProps) {
  const [selectedRole, setSelectedRole] = useState<string>("");
  const t = useTranslations("admin.roles");

  const AVAILABLE_ROLES = [
    { value: "buyer", label: t("buyer") },
    { value: "transporter", label: t("transporter") },
    { value: "admin", label: t("admin") },
  ];

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
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")} <strong>{user?.name}</strong>
            <br />
            <span className="text-xs text-muted-foreground">
              {t("currentRole")} {user?.role}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <Select
            value={selectedRole}
            onValueChange={setSelectedRole}
            disabled={isUpdating}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("selectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_ROLES.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("note")}
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isUpdating}
          >
            {t("cancel")}
          </Button>
          <Button
            onClick={handleAssignRole}
            disabled={isUpdating || !selectedRole}
          >
            {isUpdating ? (
              <>
                <LottieLoader width={20} height={20} className="mr-2" />
                {t("assigning")}
              </>
            ) : (
              t("assignRole")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
