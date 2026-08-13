"use client";

import { motion } from "framer-motion";
import {
  Play,
  Monitor,
  Smartphone,
  ArrowRight,
  Package,
  MessageSquare,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function LandingShowcase() {
  const router = useRouter();
  const t = useTranslations("marketing.showcase");

  const features = [
    {
      key: "smart",
      icon: Package,
    },
    {
      key: "msg",
      icon: MessageSquare,
    },
    {
      key: "track",
      icon: Monitor,
    },
  ];

  return (
    <div className="relative py-24 bg-linear-to-b from-background via-muted/30 to-background overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-linear-to-tr from-primary/5 via-transparent to-blue-500/5" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />

      <div className="relative container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            {t("badge")}
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            {t("title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("subtitle")}
          </p>
        </motion.div>

        {/* Main showcase area */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Video/Screenshot mockup */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            {/* Desktop frame */}
            <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-3 shadow-2xl">
              {/* Browser bar */}
              <div className="flex items-center gap-2 mb-3 px-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 h-6 bg-gray-700 rounded-md flex items-center px-3">
                  <span className="text-gray-400 text-xs">expeditoo.fr</span>
                </div>
              </div>

              {/* Screen content */}
              <div className="relative aspect-video rounded-lg overflow-hidden bg-background">
                <Image
                  src="/screenshots/home-desktop.jpg"
                  alt="Expeditoo Dashboard"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />

                {/* Floating notification elements */}
                <motion.div
                  animate={{ y: [-5, 5, -5] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute top-6 right-6 bg-white dark:bg-card rounded-lg shadow-lg p-3 z-10"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-xs font-medium text-foreground">
                      {t("ui.liveAuction")}
                    </span>
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [5, -5, 5] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="absolute bottom-6 left-6 bg-white dark:bg-card rounded-lg shadow-lg p-3 z-10"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-foreground block">
                        {t("ui.delivered")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("ui.justNow")}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Floating phone mockup */}
            <motion.div
              initial={{ opacity: 0, x: 20, y: 20 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="absolute -bottom-6 -right-2 md:-right-8 w-28 md:w-40 z-10"
            >
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-1.5 shadow-2xl">
                <div className="aspect-[9/20] rounded-2xl bg-background overflow-hidden relative">
                  <Image
                    src="/screenshots/home-mobile.jpg"
                    alt="Expeditoo Mobile App"
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 33vw, 15vw"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Features list */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="space-y-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.key}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 + 0.2 }}
                    className="flex gap-4 items-start group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-1">
                        {t(`features.${feature.key}.title`)}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {t(`features.${feature.key}.desc`)}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 pt-4"
            >
              <Button
                onClick={() => router.push("/signin")}
                className="rounded-full bg-primary hover:bg-primary/90 px-8 py-6 text-lg font-semibold"
              >
                {t("cta.start")}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                variant="outline"
                className="rounded-full px-8 py-6 text-lg font-semibold border-primary/30 hover:bg-primary/10"
              >
                <Play className="w-5 h-5 mr-2" />
                {t("cta.demo")}
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
