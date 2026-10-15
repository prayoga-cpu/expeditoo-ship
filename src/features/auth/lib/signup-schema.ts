import { z } from "zod";
import { ALIAS_MAX, NAME_PART_MAX } from "@/lib/person-name";

/**
 * The sign-up form's rules (client_feedback_2026_10_spec.md §1). The lengths
 * are `src/lib/person-name.ts`'s, which Better Auth's validators also use, so
 * the form refuses exactly what the server would.
 */

type Translate = (key: string) => string;

export interface SignupFormData {
  firstName: string;
  lastName: string;
  alias: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const namePart = (t: Translate, requiredKey: string) =>
  z
    .string()
    .trim()
    .min(1, t(requiredKey))
    .max(NAME_PART_MAX, t("errors.nameTooLong"));

export function buildSignupSchema(t: Translate) {
  return z
    .object({
      firstName: namePart(t, "errors.firstNameRequired"),
      lastName: namePart(t, "errors.lastNameRequired"),
      alias: z.string().trim().max(ALIAS_MAX, t("errors.aliasTooLong")),
      email: z
        .string()
        .min(1, t("errors.emailRequired"))
        .email(t("errors.emailInvalid")),
      password: z.string().min(8, t("errors.passwordMin")),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("errors.passwordMismatch"),
      path: ["confirmPassword"],
    });
}

export const EMPTY_SIGNUP: SignupFormData = {
  firstName: "",
  lastName: "",
  alias: "",
  email: "",
  password: "",
  confirmPassword: "",
};
