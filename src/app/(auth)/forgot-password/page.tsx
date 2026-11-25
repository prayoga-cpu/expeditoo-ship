"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthActions } from "@/features/auth/hooks/useAuthActions";
import { AuthErrorNotice, AuthShell } from "@/features/auth/ui";
import { useTranslations } from "next-intl";

// Built inside the component so its messages follow the visitor's language.
const buildSchema = (message: { required: string; invalid: string }) =>
  z.object({
    email: z.string().min(1, message.required).email(message.invalid),
  });

type ForgotPasswordFormData = z.infer<ReturnType<typeof buildSchema>>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const {
    requestPasswordReset,
    isLoading,
    error: authError,
  } = useAuthActions();
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const t = useTranslations("auth.forgotPassword");
  const tAuth = useTranslations("auth");
  const forgotPasswordSchema = useMemo(
    () =>
      buildSchema({ required: t("emailRequired"), invalid: t("emailInvalid") }),
    [t]
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    const result = await requestPasswordReset(data.email);

    // A refusal comes back through the hook's `error`, as a key the notice
    // below turns into a sentence (`auth-errors.ts`).
    if (result.success) {
      setSubmittedEmail(data.email);
      setSubmitted(true);
    }
  };

  return (
    <AuthShell>
          {!submitted ? (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {t("title")}
              </h1>
              <p className="text-muted-foreground mb-6">
                {t("subtitle")}
              </p>

              {/* Error Display */}
              <AuthErrorNotice error={authError} />

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("email")}
                  </label>
                  <Input
                    type="email"
                    placeholder={tAuth("emailPlaceholder")}
                    {...register("email")}
                    disabled={isLoading}
                    className={`${errors.email ? "border-destructive" : ""}`}
                  />
                  {errors.email && (
                    <p className="text-destructive text-sm mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-11 w-full font-semibold"
                >
                  {isLoading ? `${t("submit")}…` : t("submit")}
                </Button>
              </form>

              <button
                onClick={() => router.push("/signin")}
                className="mt-6 flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("backToLogin")}
              </button>
            </>
          ) : (
            <>
              <div>
                <MailCheck className="mb-5 size-8 text-success" aria-hidden />
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  {t("sentTitle")}
                </h1>
                <p className="text-muted-foreground mb-6">
                  {t("sentBody", { email: submittedEmail })}
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  {t("sentHint")}
                </p>

                <Button
                  onClick={() => router.push("/signin")}
                  className="h-11 w-full font-semibold"
                >
                  {t("backToLogin")}
                </Button>
              </div>
            </>
          )}
    </AuthShell>
  );
}
