"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthActions } from "@/features/auth/hooks/useAuthActions";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email"),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const {
    requestPasswordReset,
    isLoading,
    error: authError,
  } = useAuthActions();
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const t = useTranslations("auth.forgotPassword");

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
    setServerError(null);
    const result = await requestPasswordReset(data.email);

    if (result.success) {
      setSubmittedEmail(data.email);
      setSubmitted(true);
    } else if (result.error) {
      setServerError(result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/10 via-background to-background px-4 overflow-hidden relative">
      {/* Animated gradient orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Package className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground">EXPEDITOO</span>
        </div>

        {/* Card */}
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-8">
          {!submitted ? (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {t("title")}
              </h1>
              <p className="text-muted-foreground mb-6">
                {t("subtitle")}
              </p>

              {/* Error Display */}
              {(serverError || authError) && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-destructive text-sm">
                    {serverError || authError}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("email")}
                  </label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    {...register("email")}
                    disabled={isLoading}
                    className={`bg-background/50 border-border/50 ${errors.email ? "border-destructive" : ""}`}
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
                  className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground py-6 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? t("submit") + "..." : t("submit")}
                </Button>
              </form>

              <button
                onClick={() => router.push("/signin")}
                className="w-full mt-6 flex items-center justify-center gap-2 text-primary hover:text-primary/80 font-semibold"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("backToLogin")}
              </button>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl text-primary">✓</span>
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Check Your Email
                </h1>
                <p className="text-muted-foreground mb-6">
                  We've sent a password reset link to {submittedEmail}
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  The link expires in 1 hour. Check your spam folder if you
                  don't see it.
                </p>

                <Button
                  onClick={() => router.push("/signin")}
                  className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground py-6 font-semibold transition-colors"
                >
                  {t("backToLogin")}
                </Button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
