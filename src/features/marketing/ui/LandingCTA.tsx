"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { LandingGatedButton } from "./LandingGatedButton";
import { LP_BTN_GHOST, LP_BTN_PRIMARY, LP_CONTAINER, LP_SECTION } from "./styles";

const CARRIER_EMAIL = "transporteurs@expeditoo.com";

export function LandingCTA() {
  const t = useTranslations("marketing.cta");
  const { isAuthenticated } = useAuth();

  return (
    <section id="cta" className={LP_SECTION}>
      <div
        className={`${LP_CONTAINER} flex flex-wrap items-center justify-between gap-10 rounded-3xl border border-[var(--lp-line2)] bg-[var(--lp-bg2)] p-8 sm:p-14`}
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(0,82,255,0.16), rgba(255,169,31,0.07))",
        }}
      >
        <div className="flex max-w-[560px] flex-col gap-3">
          <h2 className="m-0 text-[26px] leading-[1.12] font-semibold tracking-[-0.03em] text-pretty sm:text-[34px]">
            {t("title")}
          </h2>
          <p className="m-0 text-[16.5px] leading-[1.55] text-[var(--lp-muted)]">
            {isAuthenticated ? t("subtitleAuthed") : t("subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LandingGatedButton
            intent="carrier"
            label={isAuthenticated ? t("primaryAuthed") : t("primary")}
            className={`${LP_BTN_PRIMARY} px-7 py-4 text-base`}
          />
          <a
            href={`mailto:${CARRIER_EMAIL}`}
            className={`${LP_BTN_GHOST} max-w-full px-5 py-4 text-center text-base [overflow-wrap:anywhere] sm:px-7`}
          >
            {CARRIER_EMAIL}
          </a>
        </div>
      </div>
    </section>
  );
}
