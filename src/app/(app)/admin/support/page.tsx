"use client";

import { useState, useEffect } from "react";
import { AdminSupportChats } from "@/features/app/admin/ui/AdminSupportChats";

export default function SupportPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <div className="space-y-6">
      <AdminSupportChats />
    </div>
  );
}
