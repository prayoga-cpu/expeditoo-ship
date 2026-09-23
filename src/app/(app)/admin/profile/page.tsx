import { redirect } from "next/navigation";

/** Folded into Settings — the sidebar no longer has a separate Profile entry,
 * and this only catches an old bookmark or link. */
export default function AdminProfilePage() {
  redirect("/admin/settings");
}
