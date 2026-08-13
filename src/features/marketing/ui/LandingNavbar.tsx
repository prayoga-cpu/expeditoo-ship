"use client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";

export function LandingNavbar() {
  const router = useRouter();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const t = useTranslations("marketing.navbar");
  const { isAuthenticated, isLoading } = useAuth();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 50);
  });

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "fixed top-0 z-40 w-full transition-all duration-300",
        scrolled ? "backdrop-blur-sm" : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Package className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">EXPEDITOO</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isLoading ? (
            <div className="w-24 h-9 bg-muted animate-pulse rounded-full" />
          ) : isAuthenticated ? (
            <Button
              onClick={() => router.push("/home")}
              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300"
            >
              {t("openApp")}
            </Button>
          ) : (
            <Button
              onClick={() => router.push("/signin")}
              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300"
            >
              {t("login")}
            </Button>
          )}
        </div>
      </div>
    </motion.header>
  );
}

