"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";
import { BrandMark } from "@/components/ui/brand-mark";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthActions } from "@/features/auth/hooks/useAuthActions";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

// French first, like every other page a client reaches (client feedback
// 2026-10-21, §C4): this page was the one English screen on the way back into
// an account.
function resetPasswordSchema(t: (key: string) => string) {
  return z
    .object({
      password: z.string().min(8, t("passwordMin")),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("mismatch"),
      path: ["confirmPassword"],
    });
}

type ResetPasswordFormData = z.infer<ReturnType<typeof resetPasswordSchema>>;

type ResetState = "idle" | "success" | "error" | "no-token";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth.resetPassword");
  const { resetPassword, isLoading, error: authError } = useAuthActions();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetState, setResetState] = useState<ResetState>("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setResetState("no-token");
    }
  }, [token]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema(t)),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setServerError(t("missingToken"));
      setResetState("error");
      return;
    }

    setServerError(null);
    const result = await resetPassword(token, data.password);

    if (result.success) {
      setResetState("success");
      // Redirect to signin after 3 seconds
      setTimeout(() => {
        router.push("/signin");
      }, 3000);
    } else {
      setResetState("error");
      setServerError(result.error || t("failedFallback"));
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

        {/* Reset Password Card */}
        <div className="bg-card/50 backdrop-blur-sm rounded-2xl border border-border/50 p-8">
          {/* No Token State */}
          {resetState === "no-token" && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-destructive" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
                {t("invalidTitle")}
              </h1>
              <p className="text-muted-foreground mb-6 text-center">
                {t("invalidBody")}
              </p>

              <div className="space-y-3">
                <Button
                  onClick={() => router.push("/forgot-password")}
                  className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground py-6 font-semibold transition-colors"
                >
                  {t("requestNew")}
                </Button>

                <Button
                  onClick={() => router.push("/signin")}
                  variant="outline"
                  className="w-full rounded-xl border-border/50 hover:bg-muted/50 text-foreground py-6 font-semibold transition-colors"
                >
                  {t("backToSignIn")}
                </Button>
              </div>
            </>
          )}

          {/* Success State */}
          {resetState === "success" && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-primary" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
                {t("success")}
              </h1>
              <p className="text-muted-foreground mb-6 text-center">
                {t("successBody")}
              </p>

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
                <p className="text-primary text-sm text-center">
                  {t("redirecting")}
                </p>
              </div>

              <Button
                onClick={() => router.push("/signin")}
                className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground py-6 font-semibold transition-colors"
              >
                {t("signInNow")}
              </Button>
            </>
          )}

          {/* Error State */}
          {resetState === "error" && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-destructive" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2 text-center">
                {t("failedTitle")}
              </h1>
              <p className="text-muted-foreground mb-6 text-center">
                {t("failedBody")}
              </p>

              {serverError && (
                <div className="mb-6 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-destructive text-sm text-center">
                    {serverError}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <Button
                  onClick={() => router.push("/forgot-password")}
                  className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground py-6 font-semibold transition-colors"
                >
                  {t("requestNew")}
                </Button>

                <Button
                  onClick={() => router.push("/signin")}
                  variant="outline"
                  className="w-full rounded-xl border-border/50 hover:bg-muted/50 text-foreground py-6 font-semibold transition-colors"
                >
                  {t("backToSignIn")}
                </Button>
              </div>
            </>
          )}

          {/* Idle State - Reset Form */}
          {resetState === "idle" && (
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
                    {t("password")}
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
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
                      {...register("confirmPassword")}
                      disabled={isLoading}
                      className={`bg-background/50 border-border/50 pr-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
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
                  {isLoading ? t("submitting") : t("submit")}
                </Button>
              </form>

              <Button
                onClick={() => router.push("/signin")}
                variant="outline"
                className="w-full mt-4 rounded-xl border-border/50 hover:bg-muted/50 text-foreground py-6 font-semibold transition-colors"
              >
                {t("backToSignIn")}
              </Button>
            </>
          )}
        </div>

        {/* Help Text */}
        <p className="text-center text-muted-foreground text-sm mt-6">
          {t("needHelp")}{" "}
          <a
            href="mailto:support@expeditoo.fr"
            className="text-primary hover:text-primary/80 font-medium"
          >
            {t("contactSupport")}
          </a>
        </p>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
