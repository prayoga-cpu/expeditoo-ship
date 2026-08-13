import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useSplash() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to home after 2.5 seconds
    const timer = setTimeout(() => {
      router.push("/home");
    }, 2500);

    return () => clearTimeout(timer);
  }, [router]);
}
