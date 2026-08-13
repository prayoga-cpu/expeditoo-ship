export async function shareContent({
  title,
  text,
  url,
  onCopy,
}: {
  title: string;
  text: string;
  url: string;
  onCopy?: () => void;
}) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title,
        text,
        url,
      });
      return true;
    } catch (error) {
      // Ignore abort errors (user cancelled)
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing:", error);
      }
    }
  }
  
  // Fallback to clipboard
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url);
      if (onCopy) onCopy();
      return true;
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }
  
  return false;
}
