"use client";

import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthActions } from "@/features/auth/hooks/useAuthActions";
import { AuthIntentNote, AuthSwitchLink } from "@/features/auth/ui";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

// Schema moved inside component to access translations

type SignupFormData = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export default function SignupPage() {
  const {
    signUp,
    signInWithGoogle,
    isLoading,
    error: authError,
  } = useAuthActions();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const t = useTranslations("auth.register");

  const signupSchema = z
    .object({
      fullName: z.string().min(1, t("errors.nameRequired")),
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setServerError(null);
    const result = await signUp(data.email, data.password, data.fullName);

    if (!result.success && result.error) {
      setServerError(result.error);
    }
    // If success, useAuthActions will redirect to verify-email
  };

  const handleGoogleSignIn = async () => {
    setServerError(null);
    const result = await signInWithGoogle();

    if (!result.success && result.error) {
      setServerError(result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-primary/10 via-background to-background py-8 px-4 overflow-hidden relative">
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
          <BrandMark size={40} />
          <span className="text-2xl font-bold text-foreground">EXPEDITOO</span>
        </div>

        {/* Signup Card */}
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mb-6">
            {t("subtitle")}
          </p>

          {/* Both of these read the query, which would otherwise opt this
              route out of static rendering. */}
          <Suspense fallback={null}>
            <AuthIntentNote />
          </Suspense>

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
                {t("name")}
              </label>
              <Input
                type="text"
                placeholder={t("placeholderName")}
                {...register("fullName")}
                disabled={isLoading}
                className={`bg-background/50 border-border/50 ${errors.fullName ? "border-destructive" : ""}`}
              />
              {errors.fullName && (
                <p className="text-destructive text-sm mt-1">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("email")}
              </label>
              <Input
                type="email"
                placeholder={t("placeholderEmail")}
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

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("password")}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("password")}
                  disabled={isLoading}
                  className={`bg-background/50 border-border/50 pr-10 ${errors.password ? "border-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-destructive text-sm mt-1">
                  {errors.password.message}
                </p>
              )}
              <p className="text-muted-foreground text-xs mt-1">
                {t("passwordHint")}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("confirmPassword")}
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("confirmPassword")}
                  disabled={isLoading}
                  className={`bg-background/50 border-border/50 pr-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-destructive text-sm mt-1">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground py-6 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? t("loading") : t("submit")}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-card/50 text-muted-foreground">
                {t("orContinueWith")}
              </span>
            </div>
          </div>

          {/* Google Sign Up */}
          <Button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            variant="outline"
            className="w-full rounded-xl border-border/50 hover:bg-muted/50 text-foreground py-6 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {t("signUpWithGoogle")}
          </Button>

          <Suspense fallback={null}>
            <AuthSwitchLink
              to="/signin"
              prompt={t("hasAccount")}
              action={t("signIn")}
            />
          </Suspense>

          <p className="text-xs text-muted-foreground text-center mt-4">
            {t("terms")}{" "}
            <a href="/terms" className="text-primary hover:underline">
              {t("termsOfService")}
            </a>{" "}
            {t("and")}{" "}
            <a href="/privacy" className="text-primary hover:underline">
              {t("privacyPolicy")}
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
