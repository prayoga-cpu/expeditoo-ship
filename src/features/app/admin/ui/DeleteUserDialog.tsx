"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { User } from "../types";

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onConfirm: () => void;
  isDeleting: boolean;
}

/**
 * Deleting a user takes their listings, offers, shipments, payments, messages
 * and reviews with it, and there is no undo -- so the confirmation is the
 * target's email typed out, not a button labelled "are you sure".
 */
export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  onConfirm,
  isDeleting,
}: DeleteUserDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const t = useTranslations("admin.users.deleteDialog");

  useEffect(() => {
    if (open) setConfirmation("");
  }, [open, user?.id]);

  const matches =
    confirmation.trim().toLowerCase() === user?.email.toLowerCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t("description", { name: user?.name ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-muted-foreground">
          {t("cascade")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="delete-confirmation">
            {t("prompt", { email: user?.email ?? "" })}
          </Label>
          <Input
            id="delete-confirmation"
            value={confirmation}
            autoComplete="off"
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={user?.email ?? ""}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!matches || isDeleting}
          >
            {isDeleting ? (
              <>
                <LottieLoader width={20} height={20} className="mr-2" />
                {t("deleting")}
              </>
            ) : (
              t("confirm")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
