"use client";
import {
  PlusSquare,
  MessageSquare,
  ClipboardList,
  Truck,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};



export function LandingAdvantages() {
  const t = useTranslations("marketing.advantages");

  const advantages = [
    {
      icon: PlusSquare,
      titleKey: "items.economic.title",
      descKey: "items.economic.description",
    },
    {
      icon: MessageSquare,
      titleKey: "items.ecological.title",
      descKey: "items.ecological.description",
    },
    {
      icon: ClipboardList,
      titleKey: "items.secure.title",
      descKey: "items.secure.description",
    },
    {
      icon: Truck,
      titleKey: "items.community.title",
      descKey: "items.community.description",
    },
  ];

  return (
    <div className="relative py-24 bg-linear-to-br from-background via-primary/5 to-background overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-linear-to-tr from-transparent via-primary/5 to-transparent opacity-50" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

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

        {/* 4-column Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {advantages.map((advantage) => {
            const Icon = advantage.icon;

            return (
              <motion.div
                key={advantage.titleKey}
                variants={itemVariants}
                className="group"
              >
                <div className="relative h-full p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1">
                  {/* Gradient background on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Icon */}
                  <div className="relative w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>

                  {/* Content */}
                  <h3 className="relative text-lg font-semibold text-foreground mb-2">
                    {t(advantage.titleKey)}
                  </h3>
                  <p className="relative text-muted-foreground text-sm leading-relaxed">
                    {t(advantage.descKey)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

