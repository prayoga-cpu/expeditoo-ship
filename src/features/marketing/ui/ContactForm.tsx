"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { contactSubjects } from "@/server/dto/contact.dto";
import { useContactForm } from "../hooks/useContactForm";
import { LP_BODY, LP_BTN_PRIMARY, LP_H3 } from "./styles";

const FIELD =
  "w-full rounded-xl border border-[var(--lp-line2)] bg-[var(--lp-input)] px-3.5 py-2.5 text-[15px] text-[var(--lp-text)] outline-none transition-colors focus:border-[#0052FF]";

const LABEL = "text-[13px] font-medium text-[var(--lp-text)]";

const EMPTY = {
  name: "",
  email: "",
  company: "",
  subject: "carrier",
  message: "",
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <span role="alert" className="text-[12.5px] text-[var(--lp-red)]">
      {message}
    </span>
  );
}

export function ContactForm() {
  const t = useTranslations("marketing.contact.form");
  const [values, setValues] = useState<Record<string, string>>(EMPTY);
  const { submit, fieldErrors, isPending, isSuccess, errorKind } =
    useContactForm();

  if (isSuccess) {
    return (
      <div className="flex flex-col gap-3 rounded-[20px] border border-[var(--lp-line)] bg-[var(--lp-greenbg)] p-[26px]">
        <h2 className={LP_H3}>{t("successTitle")}</h2>
        <p className={LP_BODY}>{t("successBody", { email: values.email })}</p>
      </div>
    );
  }

  const set = (key: string) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit(values);
      }}
      className="flex flex-col gap-4 rounded-[20px] border border-[var(--lp-line)] bg-[var(--lp-bg2)] p-[26px]"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>{t("name")}</span>
          <input
            className={FIELD}
            value={values.name}
            autoComplete="name"
            onChange={(event) => set("name")(event.target.value)}
          />
          <FieldError message={fieldErrors.name} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>{t("email")}</span>
          <input
            className={FIELD}
            type="email"
            value={values.email}
            autoComplete="email"
            onChange={(event) => set("email")(event.target.value)}
          />
          <FieldError message={fieldErrors.email} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>{t("company")}</span>
          <input
            className={FIELD}
            value={values.company}
            autoComplete="organization"
            onChange={(event) => set("company")(event.target.value)}
          />
          <FieldError message={fieldErrors.company} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>{t("subject")}</span>
          <select
            className={FIELD}
            value={values.subject}
            onChange={(event) => set("subject")(event.target.value)}
          >
            {/* Options come from the DTO, never a second list here. */}
            {contactSubjects.map((subject) => (
              <option key={subject} value={subject}>
                {t(`subjects.${subject}`)}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.subject} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>{t("message")}</span>
        <textarea
          className={`${FIELD} min-h-[150px] resize-y`}
          value={values.message}
          onChange={(event) => set("message")(event.target.value)}
        />
        <FieldError message={fieldErrors.message} />
      </label>

      {errorKind ? (
        <p role="alert" className="m-0 text-[13.5px] text-[var(--lp-red)]">
          {t(errorKind)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className={`${LP_BTN_PRIMARY} px-7 py-3 text-[15px] disabled:opacity-60`}
        >
          {isPending ? t("sending") : t("send")}
        </button>
        <span className="text-[12.5px] text-[var(--lp-faint)]">
          {t("privacyNote")}
        </span>
      </div>
    </form>
  );
}
