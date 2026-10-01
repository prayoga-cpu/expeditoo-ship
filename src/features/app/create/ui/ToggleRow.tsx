"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/**
 * One yes/no fact about the job, as a bordered row with its switch on the
 * right. Shared by the "What" step's cargo toggles, `PackagingField` and the
 * "Where" step's lift question, so every switch on /create looks the same.
 */
export function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
