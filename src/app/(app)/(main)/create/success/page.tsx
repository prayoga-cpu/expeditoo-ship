import { redirect } from "next/navigation";

/**
 * No request named, so nothing to thank anyone for: the requester's own list
 * is the nearest real page. The app has no `not-found.tsx` of its own.
 */
export default function RequestPostedIndexPage() {
  redirect("/listings/me");
}
