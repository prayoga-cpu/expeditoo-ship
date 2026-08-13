import { DriverApplicationsList } from "@/features/app/admin/ui/DriverApplicationsList";
import { Truck } from "lucide-react";

export default function DriverApplicationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Truck className="w-8 h-8 text-primary" />
          Driver Applications
        </h1>
        <p className="text-muted-foreground">
          Review and manage driver applications
        </p>
      </div>

      <DriverApplicationsList />
    </div>
  );
}
