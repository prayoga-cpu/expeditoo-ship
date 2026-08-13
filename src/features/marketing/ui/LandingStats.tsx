"use client";

import { Package, Users, Gavel, Star } from "lucide-react";
import {
  motion,
  useInView,
  useSpring,
  useTransform,
  Variants,
} from "framer-motion";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";



function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const spring = useSpring(0, {
    mass: 0.8,
    stiffness: 75,
    damping: 15,
  });

  const display = useTransform(spring, (current) =>
    Math.round(current).toLocaleString()
  );

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, spring, value]);

  return (
    <span ref={ref} className="tabular-nums">
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
}

export function LandingStats() {
  const t = useTranslations("marketing.stats");

  const statistics = [
    {
      icon: Package,
      value: 50000,
      suffix: "+",
      key: "deliveries",
    },
    {
      icon: Users,
      value: 2500,
      suffix: "+",
      key: "drivers",
    },
    {
      icon: Gavel,
      value: 1200,
      suffix: "+",
      key: "auctions",
    },
    {
      icon: Star,
      value: 15000,
      suffix: "+",
      key: "users",
    },
  ];

  const cardVariants: Variants = {
    offscreen: {
      y: 60,
      opacity: 0,
      scale: 0.9,
    },
    onscreen: {
      y: 0,
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        bounce: 0.4,
        duration: 0.8,
      },
    },
  };

  return (
    <div className="relative py-20 bg-linear-to-br from-background via-muted/20 to-background overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-linear-to-tr from-primary/5 via-transparent to-transparent opacity-50" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="relative container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statistics.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.key}
                initial="offscreen"
                whileInView="onscreen"
                viewport={{ once: true, amount: 0.3 }}
                variants={cardVariants}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="relative p-8 rounded-3xl bg-card/50 backdrop-blur-sm border border-border/50 transition-all duration-500 h-full hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-2 overflow-hidden text-center">
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  {/* Icon */}
                  <div className="relative w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 mx-auto transition-all duration-300 group-hover:bg-primary/20 group-hover:scale-110">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>

                  {/* Value */}
                  <div className="relative text-4xl md:text-5xl font-bold text-foreground mb-2">
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </div>

                  {/* Label */}
                  <div className="relative text-muted-foreground text-sm font-medium">
                    {t(stat.key)}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
