import { AdminLayout } from "@/features/app/admin/ui";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
