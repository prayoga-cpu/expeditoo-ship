"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import { useTranslations } from "next-intl";

const testimonials = [
  {
    id: "sarah",
    avatar: "/placeholder-user.jpg",
    rating: 5,
  },
  {
    id: "michel",
    avatar: "/placeholder-user.jpg",
    rating: 5,
  },
  {
    id: "julie",
    avatar: "/placeholder-user.jpg",
    rating: 5,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.5,
    },
  },
};

export function LandingTestimonials() {
  const t = useTranslations("marketing.testimonials");

  return (
    <div className="relative py-24 bg-muted/30 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-linear-to-b from-background via-transparent to-background" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Floating quote marks */}
      <motion.div
        animate={{ y: [-10, 10, -10], rotate: [-5, 5, -5] }}
        transition={{ duration: 8, repeat: Infinity }}
        className="absolute top-20 left-[10%] hidden lg:block"
      >
        <Quote className="w-24 h-24 text-primary/10" />
      </motion.div>
      <motion.div
        animate={{ y: [10, -10, 10], rotate: [5, -5, 5] }}
        transition={{ duration: 10, repeat: Infinity }}
        className="absolute bottom-20 right-[10%] hidden lg:block"
      >
        <Quote className="w-32 h-32 text-primary/10 rotate-180" />
      </motion.div>

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

        {/* Testimonials grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="group relative"
            >
              <div className="relative h-full p-8 rounded-3xl bg-card border border-border/50 transition-all duration-500 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-2 overflow-hidden">
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Quote icon */}
                <div className="relative mb-6">
                  <Quote className="w-10 h-10 text-primary/30" />
                </div>

                {/* Stars */}
                <div className="relative flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 + i * 0.05 + 0.3 }}
                    >
                      <Star
                        className={`w-5 h-5 ${i < testimonial.rating
                          ? "text-primary fill-primary"
                          : "text-muted"
                          }`}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* Comment */}
                <p className="relative text-foreground mb-6 leading-relaxed">
                  &quot;{t(`items.${testimonial.id}.comment`)}&quot;
                </p>

                {/* Highlight badge */}
                <div className="relative mb-6">
                  <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                    {t(`items.${testimonial.id}.highlight`)}
                  </span>
                </div>

                {/* Author */}
                <div className="relative flex items-center gap-4">
                  <div className="relative">
                    <Image
                      src={testimonial.avatar}
                      alt={t(`items.${testimonial.id}.name`)}
                      width={56}
                      height={56}
                      className="rounded-full border-2 border-primary/20"
                    />
                    {/* Online indicator */}
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-card" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground">
                      {t(`items.${testimonial.id}.name`)}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {t(`items.${testimonial.id}.role`)}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
