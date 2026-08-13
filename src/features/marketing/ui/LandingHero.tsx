"use client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Package, Truck, Gavel } from "lucide-react";
import { useTranslations } from "next-intl";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 },
  },
};

const floatingVariants = {
  animate: {
    y: [-10, 10, -10],
    rotate: [-5, 5, -5],
    transition: {
      duration: 6,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

const pulseVariants = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [0.3, 0.5, 0.3],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

export function LandingHero() {
  const router = useRouter();
  const t = useTranslations("marketing.hero");

  return (
    <div className="relative min-h-[85vh] bg-linear-to-br from-primary/10 via-background to-background overflow-hidden flex items-center">
      {/* Animated gradient orbs - blue only */}
      <motion.div
        variants={pulseVariants}
        animate="animate"
        className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl"
      />
      <motion.div
        variants={pulseVariants}
        animate="animate"
        style={{ animationDelay: "2s" }}
        className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"
      />
      <motion.div
        variants={pulseVariants}
        animate="animate"
        style={{ animationDelay: "1s" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-3xl"
      />

      {/* Floating decorative icons */}
      <motion.div
        variants={floatingVariants}
        animate="animate"
        className="absolute top-32 right-[15%] hidden lg:block"
      >
        <div className="w-16 h-16 rounded-2xl bg-card/80 backdrop-blur-sm border border-border shadow-xl flex items-center justify-center">
          <Package className="w-8 h-8 text-primary" />
        </div>
      </motion.div>
      <motion.div
        variants={floatingVariants}
        animate="animate"
        style={{ animationDelay: "1s" }}
        className="absolute bottom-40 left-[10%] hidden lg:block"
      >
        <div className="w-20 h-20 rounded-2xl bg-card/80 backdrop-blur-sm border border-border shadow-xl flex items-center justify-center">
          <Truck className="w-10 h-10 text-primary" />
        </div>
      </motion.div>
      <motion.div
        variants={floatingVariants}
        animate="animate"
        style={{ animationDelay: "2s" }}
        className="absolute top-1/2 right-[8%] hidden lg:block"
      >
        <div className="w-14 h-14 rounded-2xl bg-card/80 backdrop-blur-sm border border-border shadow-xl flex items-center justify-center">
          <Gavel className="w-7 h-7 text-primary" />
        </div>
      </motion.div>

      {/* Main content */}
      <div className="relative container mx-auto px-4 pt-24 md:pt-16 pb-24">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center max-w-4xl mx-auto"
        >
          {/* Badge */}
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            {t("badge")}
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemVariants}
            className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight tracking-tight"
          >
            {t("titleLine1")}
            <br />
            <span className="bg-gradient-to-r from-primary via-blue-500 to-primary bg-clip-text text-transparent">
              {t("titleLine2")}
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl"
          >
            {t("subtitle")}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4"
          >

            <Button
              onClick={() => router.push("/home")}
              variant="outline"
              className="rounded-full px-8 py-6 text-lg font-semibold border-2 border-primary/50 text-primary hover:bg-primary/10 hover:border-primary transition-all duration-300"
            >
              <Gavel className="w-5 h-5 mr-2" />
              {t("secondaryCta")}
            </Button>
          </motion.div>

          {/* Trust indicators */}
          <motion.div
            variants={itemVariants}
            className="mt-16 flex flex-col items-center"
          >
            <p className="text-muted-foreground text-sm mb-4">
              {t("trustedBy")}
            </p>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <motion.svg
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1 + i * 0.1 }}
                  className="w-5 h-5 text-primary fill-current"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </motion.svg>
              ))}
              <span className="ml-2 text-muted-foreground text-sm">
                {t("rating")}
              </span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2"
        >
          <motion.div className="w-1 h-2 bg-muted-foreground/50 rounded-full" />
        </motion.div>
      </motion.div>
    </div>
  );
}
