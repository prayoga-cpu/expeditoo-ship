import { Suspense } from "react";
import { PageLoader } from "@/components/ui/page-loader";
import { ExpedionDashboard } from "@/features/app/admin/expedion/ui/ExpedionDashboard";

// `Suspense` is load-bearing: the dashboard reads `?quote=` through
// `useSearchParams`, which builds without a boundary and then fails `next build`.
export default function ExpedionAdminPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ExpedionDashboard />
    </Suspense>
  );
}
