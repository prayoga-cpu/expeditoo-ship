import { PageLoader } from "@/components/ui/page-loader";

/**
 * The tap answers at once (2.92.0 #36). Without a boundary of its own a
 * segment kept showing the page it was leaving until the next one's data was
 * ready, so a tap on the bar or the sidebar looked ignored and was repeated.
 * This one sits at the segment's root, so every route beneath it that has no
 * `loading.tsx` of its own is covered, inside the shell's chrome.
 */
export default function Loading() {
  return <PageLoader />;
}
