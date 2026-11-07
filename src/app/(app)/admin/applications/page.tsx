import { redirect } from "next/navigation";

/**
 * Driver applications are a tab of Drivers now, not a page of their own. The
 * old URL stays because it is in sent emails and stored notifications.
 */
export default function CarrierApplicationsRedirect() {
  redirect("/admin/drivers?tab=applications");
}
