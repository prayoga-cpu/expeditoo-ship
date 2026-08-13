"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

const categories = [
  {
    id: "furniture",
    image: "/categories/furniture.png",
  },
  {
    id: "carParts",
    image: "/categories/car-parts.png",
  },
  {
    id: "electronics",
    image: "/categories/electronics.png",
  },
  {
    id: "appliances",
    image: "/categories/appliances.png",
  },
  {
    id: "sports",
    image: "/categories/sports.png",
  },
  {
    id: "music",
    image: "/categories/music.png",
  },
  {
    id: "pets",
    image: "/categories/pets.png",
  },
  {
    id: "more",
    image: "/categories/misc.png",
  },
];

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
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export function LandingWhatToShip() {
  const t = useTranslations("marketing.whatToShip");

  return (
    <div className="relative py-24 bg-background overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-linear-to-b from-muted/20 via-transparent to-muted/20" />

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
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto whitespace-pre-line">
            {t("subtitle")}
          </p>
        </motion.div>

        {/* Regular Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
        >
          {categories.map((category, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="group relative aspect-square rounded-2xl overflow-hidden cursor-pointer"
            >
              {/* Image */}
              <Image
                src={category.image}
                alt={t(`items.${category.id}.name`)}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-300" />

              {/* Content */}
              <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-5">
                <h3 className="text-white text-lg md:text-xl font-bold mb-1 group-hover:text-primary transition-colors duration-300">
                  {t(`items.${category.id}.name`)}
                </h3>
                <p className="text-white/70 text-xs md:text-sm hidden md:block group-hover:text-white/90 transition-colors duration-300">
                  {t(`items.${category.id}.desc`)}
                </p>
              </div>

              {/* Arrow indicator */}
              <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:bg-primary">
                <ArrowRight className="w-4 h-4 text-white" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
