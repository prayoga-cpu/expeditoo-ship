"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gavel, Package, Search, Truck, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

export function LandingHowItWorks() {
  const [activeTab, setActiveTab] = useState("sender");
  const t = useTranslations("marketing.howItWorks");

  const senderSteps = [
    {
      icon: Package,
      title: t("sender.step1.title"),
      description: t("sender.step1.desc"),
    },
    {
      icon: Truck,
      title: t("sender.step2.title"),
      description: t("sender.step2.desc"),
    },
    {
      icon: Search,
      title: t("sender.step3.title"),
      description: t("sender.step3.desc"),
    },
    {
      icon: Package,
      title: t("sender.step4.title"),
      description: t("sender.step4.desc"),
    },
  ];

  const courierSteps = [
    {
      icon: Search,
      title: t("courier.step1.title"),
      description: t("courier.step1.desc"),
    },
    {
      icon: Gavel,
      title: t("courier.step2.title"),
      description: t("courier.step2.desc"),
    },
    {
      icon: Truck,
      title: t("courier.step3.title"),
      description: t("courier.step3.desc"),
    },
    {
      icon: Package,
      title: t("courier.step4.title"),
      description: t("courier.step4.desc"),
    },
  ];

  const auctionSteps = [
    {
      icon: Search,
      title: t("auction.step1.title"),
      description: t("auction.step1.desc"),
    },
    {
      icon: Gavel,
      title: t("auction.step2.title"),
      description: t("auction.step2.desc"),
    },
    {
      icon: Package,
      title: t("auction.step3.title"),
      description: t("auction.step3.desc"),
    },
    {
      icon: Truck,
      title: t("auction.step4.title"),
      description: t("auction.step4.desc"),
    },
  ];

  const tabs = [
    { id: "sender", label: t("tabs.sender"), icon: Package },
    { id: "courier", label: t("tabs.courier"), icon: Truck },
    { id: "auction", label: t("tabs.auction"), icon: Gavel },
  ];

  const steps =
    activeTab === "sender"
      ? senderSteps
      : activeTab === "courier"
        ? courierSteps
        : auctionSteps;

  return (
    <div className="relative py-24 bg-linear-to-br from-muted/30 via-background to-primary/5 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-linear-to-tl from-primary/5 via-transparent to-transparent" />
      <div className="absolute top-1/2 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2" />

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
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            {t("title")}
          </h2>

        </motion.div>

        {/* Tab switcher */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex justify-center mb-12"
        >
          <div className="inline-flex rounded-2xl bg-muted/50 backdrop-blur-sm p-1.5 border border-border/50">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-6 py-3 rounded-xl text-sm md:text-base font-semibold transition-all duration-300 flex items-center gap-2 ${isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-primary rounded-xl shadow-lg"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                  <Icon className="w-4 h-4 relative z-10" />
                  <span className="relative z-10 hidden sm:inline">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Steps */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="relative"
          >
            {/* Connection line - desktop - positioned in front */}
            <div className="hidden lg:block absolute top-12 left-[12%] right-[12%] h-0.5 z-10">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1, delay: 0.3 }}
                className="absolute inset-0 bg-gradient-to-r from-primary via-blue-500 to-primary origin-left"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.15 }}
                    className="relative group text-center"
                  >
                    {/* Card */}
                    <div className="pt-4">
                      <div className="relative z-20 w-16 h-16 mx-auto mb-6 rounded-2xl bg-card border border-border flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:border-primary/50">
                        <Icon className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold text-foreground mb-3">
                        {step.title}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        {step.description}
                      </p>
                    </div>

                    {/* Mobile connector arrow */}
                    {index < steps.length - 1 && (
                      <div className="flex justify-center my-4 lg:hidden">
                        <ChevronRight className="w-6 h-6 text-primary/50 rotate-90" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
